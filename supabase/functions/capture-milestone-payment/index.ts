import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { assertCanReleaseMilestone, EscrowAuthError, loadMilestoneForIntent } from "../_shared/escrowAuth.ts";
import { syncProjectStatusIfAllMilestonesPaid } from "../_shared/milestoneProjectSync.ts";
import { resolveStripeSecretKey } from "../_shared/stripeEnv.ts";
import { resolveMilestonePayee } from "../_shared/resolveMilestonePayee.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CAPTURE-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  // Admin client for bypassing RLS (invoice creation)
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { paymentIntentId, action, milestoneId } = await req.json();
    if (!paymentIntentId || !action || !milestoneId) {
      throw new Error("Missing required fields: paymentIntentId, action, or milestoneId");
    }

    if (!['capture', 'cancel'].includes(action)) {
      throw new Error("Invalid action. Must be 'capture' or 'cancel'");
    }

    logStep("Request received", { paymentIntentId, action, milestoneId });

    const stripe = new Stripe(resolveStripeSecretKey(), {
      apiVersion: "2025-08-27.basil",
    });

    // --- Authorization: only the payer (or the project's client/owner) may release escrow ---
    const authMilestone = await loadMilestoneForIntent(supabaseAdmin, milestoneId, paymentIntentId);
    const intentForAuth = await stripe.paymentIntents.retrieve(paymentIntentId);
    await assertCanReleaseMilestone(
      supabaseAdmin,
      authMilestone,
      user.id,
      (intentForAuth.metadata || {}) as Record<string, string>,
    );
    logStep("Authorization passed", { userId: user.id, milestoneId });

    let result;
    let newStatus;
    let newEscrowStatus;

    if (action === 'capture') {
      // Capture the authorized payment
      logStep("Capturing payment");
      result = await stripe.paymentIntents.capture(paymentIntentId);
      newStatus = 'paid';
      newEscrowStatus = 'captured';
      logStep("Payment captured successfully", { paymentIntentId });
    } else {
      // Cancel the authorized payment (refund)
      logStep("Cancelling payment");
      result = await stripe.paymentIntents.cancel(paymentIntentId);
      newStatus = 'review'; // Go back to review status
      newEscrowStatus = 'cancelled';
      logStep("Payment cancelled successfully", { paymentIntentId });
    }

    // Fetch milestone details before updating
    const { data: milestone, error: fetchError } = await supabaseAdmin
      .from('milestones')
      .select('*, projects(id, title, created_by)')
      .eq('id', milestoneId)
      .eq('payment_intent_id', paymentIntentId)
      .single();

    if (fetchError) {
      logStep("ERROR fetching milestone", { error: fetchError.message });
      throw new Error(`Failed to fetch milestone: ${fetchError.message}`);
    }

    // Who actually gets paid -- NOT necessarily milestone.created_by. See
    // _shared/resolveMilestonePayee.ts: on the primary "Brand creates the
    // milestone" path, created_by is the Brand's own id, not the Creator's.
    const payee = await resolveMilestonePayee(supabaseAdmin, milestone);
    if (payee.ambiguous) {
      logStep("WARNING: ambiguous milestone payee -- falling back to created_by", {
        milestoneId, candidateCount: payee.candidateCount,
      });
    }

    // Update milestone in database
    const { error: updateError } = await supabaseAdmin
      .from('milestones')
      .update({
        status: newStatus,
        escrow_status: newEscrowStatus,
        paid_at: action === 'capture' ? new Date().toISOString() : null,
        paid_to: action === 'capture' ? payee.payeeUserId : null,
      })
      .eq('id', milestoneId)
      .eq('payment_intent_id', paymentIntentId);

    if (updateError) {
      logStep("ERROR updating milestone", { error: updateError.message });
      throw new Error(`Failed to update milestone: ${updateError.message}`);
    }

    logStep("Milestone updated successfully", { milestoneId, newStatus, newEscrowStatus });

    // Auto-generate invoice + record commission when payment is captured
    if (action === 'capture') {
      try {
        logStep("Processing captured payment — invoice + commission");

        // Retrieve payment intent metadata for fee breakdown
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        const metadata = paymentIntent.metadata || {};
        const talentRate = parseFloat(metadata.talentRate || String(milestone.amount));
        const platformFee = parseFloat(metadata.platformFee || '0');
        const managerCommission = parseFloat(metadata.managerCommission || '0');
        const managerTableId = metadata.managerTableId || null;
        const managerStripeAccountId = metadata.managerStripeAccountId || null;

        logStep("Fee breakdown from metadata", { talentRate, platformFee, managerCommission, managerTableId, managerStripeAccountId });

        // Record manager commission if applicable
        if (managerTableId && managerCommission > 0) {
          const { error: commissionError } = await supabaseAdmin
            .from('referral_commissions')
            .insert({
              manager_id: managerTableId,
              talent_user_id: payee.payeeUserId,
              source_type: 'milestone',
              source_id: milestoneId,
              gross_amount: talentRate,
              commission_rate: 0.10,
              commission_amount: managerCommission,
              currency: 'USD',
              status: managerStripeAccountId ? 'paid' : 'earned',
            });

          if (commissionError) {
            logStep("WARNING: Failed to record commission", { error: commissionError.message });
          } else {
            logStep("Manager commission recorded", { managerTableId, amount: managerCommission });
          }

          // Transfer commission to manager's Stripe Connect account.
          //
          // Idempotent by construction (ESCROW_TRANSFER_IDEMPOTENCY_REPORT.md):
          // a 'reserved' row is inserted into milestone_commission_transfers
          // BEFORE calling Stripe, keyed on (milestone_id, manager_id) --
          // a deterministic key derived from stable business identity, not a
          // random per-attempt value. A duplicate/concurrent/retried request
          // for the same commission collapses onto that same row instead of
          // creating a second reservation or a second transfer. The same
          // deterministic string is also passed to Stripe as the
          // Idempotency-Key header, so even if two reservations somehow both
          // reached the Stripe call (they can't, per the logic below), Stripe
          // itself would still dedupe them for 24h.
          if (managerStripeAccountId && managerCommission > 0) {
            const operationKey = `milestone_commission_transfer:${milestoneId}:${managerTableId}`;

            const { data: reservation, error: reserveError } = await supabaseAdmin
              .from('milestone_commission_transfers')
              .insert({
                milestone_id: milestoneId,
                manager_id: managerTableId,
                commission_amount: managerCommission,
                destination_account: managerStripeAccountId,
                project_id: milestone.project_id,
                idempotency_key: operationKey,
                reserved_by: user.id,
                status: 'reserved',
              })
              .select()
              .single();

            let ledgerRow = reservation;
            if (reserveError && (reserveError as { code?: string }).code === '23505') {
              // Conflict on the (milestone_id, manager_id) primary key --
              // another attempt (this request retried, or a genuine
              // concurrent duplicate) already reserved this exact commission.
              const { data: existingRow, error: lookupError } = await supabaseAdmin
                .from('milestone_commission_transfers')
                .select('*')
                .eq('milestone_id', milestoneId)
                .eq('manager_id', managerTableId)
                .maybeSingle();
              if (lookupError || !existingRow) {
                logStep("WARNING: commission transfer reservation conflicted and no existing row found -- skipping transfer, not guessing", { error: lookupError?.message });
                ledgerRow = null;
              } else {
                ledgerRow = existingRow;
              }
            } else if (reserveError) {
              // Not a duplicate-key conflict -- most likely
              // milestone_commission_transfers doesn't exist yet (the
              // 20260824120000 migration hasn't been applied). Fail closed:
              // skip the transfer rather than proceed without the
              // idempotency guard this whole block exists to provide.
              logStep("WARNING: commission transfer reservation failed (is the migration applied?) -- skipping transfer rather than proceeding unguarded", { error: reserveError.message });
              ledgerRow = null;
            }

            const mismatched = ledgerRow && (
              Number(ledgerRow.commission_amount) !== managerCommission ||
              ledgerRow.destination_account !== managerStripeAccountId
            );

            const reservedAgeMs = ledgerRow?.created_at ? Date.now() - new Date(ledgerRow.created_at).getTime() : 0;
            const isFreshConcurrentReservation = ledgerRow?.status === 'reserved' && reservedAgeMs < 60_000 && ledgerRow?.reserved_by !== user.id;

            if (!ledgerRow) {
              // handled above -- no-op, already logged
            } else if (mismatched) {
              logStep("ERROR: commission transfer amount/destination mismatch vs existing reservation -- refusing to transfer", {
                milestoneId, managerTableId,
                expected: { amount: ledgerRow.commission_amount, destination: ledgerRow.destination_account },
                actual: { amount: managerCommission, destination: managerStripeAccountId },
              });
            } else if (ledgerRow.status === 'completed') {
              logStep("Commission transfer already completed -- skipping duplicate transfer", { transferId: ledgerRow.stripe_transfer_id });
            } else if (isFreshConcurrentReservation) {
              logStep("WARNING: concurrent commission transfer already reserved by another request -- skipping, not double-transferring", { milestoneId, managerTableId });
            } else {
              // Either the first attempt for this reservation, or a safe
              // retry of a 'failed' / stale 'reserved' (>60s, likely a prior
              // process that crashed between reserve and resolve) row --
              // same operation key either way, so Stripe's own idempotency
              // cache is the backstop if the earlier attempt actually landed.
              try {
                const transfer = await stripe.transfers.create({
                  amount: Math.round(managerCommission * 100),
                  currency: 'usd',
                  destination: managerStripeAccountId,
                  description: `Manager commission for milestone: ${milestone.title}`,
                  metadata: {
                    milestone_id: milestoneId,
                    project_id: milestone.project_id,
                    manager_table_id: managerTableId,
                    commission_rate: '0.10',
                  },
                }, { idempotencyKey: operationKey });

                await supabaseAdmin
                  .from('milestone_commission_transfers')
                  .update({ status: 'completed', stripe_transfer_id: transfer.id, completed_at: new Date().toISOString(), last_error: null })
                  .eq('milestone_id', milestoneId)
                  .eq('manager_id', managerTableId);

                logStep("Commission transferred to manager", { transferId: transfer.id, amount: managerCommission, destination: managerStripeAccountId, operationKey });

                // Update total_earned on talent_managers
                await supabaseAdmin.rpc('increment_manager_earnings' as any, {
                  manager_id_input: managerTableId,
                  amount_input: managerCommission,
                }).then(() => {
                  logStep("Manager earnings updated");
                }).catch((err: any) => {
                  logStep("WARNING: Failed to update manager earnings", { error: String(err) });
                });
              } catch (transferErr: any) {
                // Release the reservation for a future retry -- 'failed' is
                // not terminal here, it's what lets the next invocation
                // (same operation key) try again instead of being permanently
                // blocked by a stuck 'reserved' row.
                await supabaseAdmin
                  .from('milestone_commission_transfers')
                  .update({ status: 'failed', last_error: String(transferErr?.message || transferErr) })
                  .eq('milestone_id', milestoneId)
                  .eq('manager_id', managerTableId);

                logStep("WARNING: Failed to transfer commission to manager", { error: transferErr.message });
                // Update commission status back to 'earned' (pending manual payout)
                await supabaseAdmin
                  .from('referral_commissions')
                  .update({ status: 'earned' })
                  .eq('manager_id', managerTableId)
                  .eq('source_id', milestoneId);
              }
            }
          }
        }

        // Get profiles for invoice
        const { data: payerProfile } = await supabaseAdmin
          .from('profiles')
          .select('full_name, avatar_url, role')
          .eq('user_id', user.id)
          .single();

        const { data: creatorProfile } = await supabaseAdmin
          .from('profiles')
          .select('full_name')
          .eq('user_id', payee.payeeUserId)
          .single();

        const { data: creatorAuth } = await supabaseAdmin.auth.admin.getUserById(payee.payeeUserId);

        const now = new Date();
        const invoiceNumber = `INV-${now.getFullYear()}-${now.getTime()}`;

        const lineItems = [
          {
            description: `Milestone: ${milestone.title}`,
            quantity: 1,
            rate: talentRate,
            amount: talentRate,
          }
        ];

        if (platformFee > 0) {
          lineItems.push({
            description: `Kretopia Service Fee`,
            quantity: 1,
            rate: platformFee,
            amount: platformFee,
          });
        }

        if (managerCommission > 0) {
          lineItems.push({
            description: `Talent Manager Commission`,
            quantity: 1,
            rate: managerCommission,
            amount: managerCommission,
          });
        }

        const totalAmount = talentRate + platformFee + managerCommission;

        const invoiceData = {
          invoice_number: invoiceNumber,
          issued_by: user.id,
          issued_to: payee.payeeUserId,
          project_id: milestone.project_id,
          milestone_id: milestoneId,
          amount: totalAmount,
          currency: 'USD',
          status: 'paid',
          paid_at: now.toISOString(),
          brand_name: payerProfile?.full_name || 'Client',
          recipient_name: creatorProfile?.full_name || 'Creator',
          recipient_email: creatorAuth?.user?.email || null,
          payment_method: 'stripe_escrow',
          payment_details: {
            payment_intent_id: paymentIntentId,
            escrow: true,
            auto_generated: true,
            talent_rate: talentRate,
            platform_fee: platformFee,
            manager_commission: managerCommission,
            manager_table_id: managerTableId,
          },
          line_items: lineItems,
          notes: `Auto-generated invoice for milestone "${milestone.title}" on project "${milestone.projects?.title || 'Project'}". Talent received $${talentRate.toFixed(2)} (100% of rate). Service fee and commissions charged to brand.`,
        };

        const { data: invoice, error: invoiceError } = await supabaseAdmin
          .from('invoices')
          .insert(invoiceData)
          .select('id, invoice_number')
          .single();

        if (invoiceError) {
          logStep("WARNING: Failed to create auto-invoice", { error: invoiceError.message });
        } else {
          logStep("Auto-invoice created", { invoiceId: invoice.id, invoiceNumber: invoice.invoice_number });
        }
      } catch (invoiceErr) {
        logStep("WARNING: Auto-invoice generation failed", { error: String(invoiceErr) });
      }
    }

    // Notifications: notify creator + client of capture/cancel outcome
    try {
      const projectTitle = milestone.projects?.title || 'Project';
      const link = `/desk/${milestone.project_id}?tab=finance`;
      if (action === 'capture') {
        // Pay creator notif
        await supabaseAdmin.from('notifications').insert([
          {
            user_id: payee.payeeUserId,
            title: 'Payment released! 💰',
            message: `$${Number(milestone.amount).toFixed(2)} for "${milestone.title}" was released to you on ${projectTitle}.`,
            type: 'payment',
            category: 'payment',
            priority: 'high',
            link,
            action_url: link,
            action_text: 'View milestone',
          },
          {
            user_id: user.id,
            title: 'Escrow released ✓',
            message: `You released $${Number(milestone.amount).toFixed(2)} for "${milestone.title}".`,
            type: 'payment',
            category: 'payment',
            priority: 'normal',
            link,
            action_url: link,
            action_text: 'View milestone',
          },
        ]);
      } else {
        // Cancel/refund notif
        await supabaseAdmin.from('notifications').insert([
          {
            user_id: payee.payeeUserId,
            title: 'Escrow refunded',
            message: `The client cancelled the escrow for "${milestone.title}" — funds were refunded.`,
            type: 'payment',
            category: 'payment',
            priority: 'high',
            link,
            action_url: link,
            action_text: 'View milestone',
          },
        ]);
      }
      logStep("Notifications dispatched", { action });
    } catch (notifErr) {
      logStep("WARNING: notification dispatch failed", { error: String(notifErr) });
    }

    if (action === 'capture') {
      try {
        await syncProjectStatusIfAllMilestonesPaid(supabaseAdmin, milestone.project_id);
      } catch (syncErr) {
        logStep("WARNING: project status sync failed", { error: String(syncErr) });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      action,
      status: result.status,
      escrowStatus: newEscrowStatus
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const status = error instanceof EscrowAuthError ? error.status : 500;
    logStep("ERROR in capture payment", { message: errorMessage, status });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});
