import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { syncProjectStatusIfAllMilestonesPaid } from "../_shared/milestoneProjectSync.ts";
import { resolveStripeSecretKey, assertEventMatchesMode } from "../_shared/stripeEnv.ts";
import { resolveMilestonePayee } from "../_shared/resolveMilestonePayee.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-MARKETPLACE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(resolveStripeSecretKey(), {
      apiVersion: "2025-08-27.basil",
    });

    const webhookSecret = Deno.env.get("STRIPE_MARKETPLACE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      logStep("ERROR", { message: "STRIPE_MARKETPLACE_WEBHOOK_SECRET not configured" });
      return new Response("Webhook secret not configured", { status: 500 });
    }

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      logStep("ERROR", { message: "No stripe-signature header" });
      return new Response("No signature", { status: 400 });
    }

    const body = await req.text();
    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret,
        undefined,
        Stripe.createSubtleCryptoProvider()
      );
      assertEventMatchesMode(event.livemode);
    } catch (err) {
      logStep("Signature verification failed", { error: String(err) });
      return new Response("Invalid signature", { status: 400 });
    }

    logStep("Event received", { type: event.type, id: event.id });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Idempotency by Stripe event ID — mirrors stripe-wallet-webhook and
    // guest-wallet-webhook. Without this, a redelivered checkout.session.completed
    // re-increments payment_links.use_count (KREPAY_PAYMENT_AUDIT.md finding #3),
    // prematurely disabling single_use/max_uses links after one real payment.
    const { error: dupErr } = await supabaseAdmin.from("stripe_webhook_events").insert({
      event_id: event.id,
      type: event.type,
      payload: event as unknown as Record<string, unknown>,
    });
    if (dupErr && (dupErr as { code?: string }).code === "23505") {
      logStep("Duplicate event ignored", { id: event.id });
      return new Response(JSON.stringify({ received: true, idempotent_event: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const kind = session.metadata?.kind;

      // ── Invoice payment ──
      if (kind === "invoice" && session.payment_status === "paid") {
        const invoiceId = session.metadata?.invoice_id;
        if (invoiceId) {
          await supabaseAdmin
            .from("invoices")
            .update({
              status: "paid",
              paid_at: new Date().toISOString(),
              stripe_payment_intent_id: session.payment_intent as string,
            })
            .eq("id", invoiceId);

          const recipientUserId = session.metadata?.recipient_user_id;
          if (recipientUserId) {
            await supabaseAdmin.from("notifications").insert({
              user_id: recipientUserId,
              title: "Invoice paid 💰",
              message: `Invoice payment received via ThrivePay`,
              type: "payment",
              category: "payment",
              priority: "high",
              link: "/thrivepay",
            });
          }
          logStep("Invoice marked paid", { invoiceId });
        }
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── Payment link ──
      if (kind === "payment_link" && session.payment_status === "paid") {
        const linkId = session.metadata?.payment_link_id;
        if (linkId) {
          await supabaseAdmin
            .from("payment_link_payments")
            .update({
              status: "paid",
              paid_at: new Date().toISOString(),
              stripe_payment_intent_id: session.payment_intent as string,
            })
            .eq("stripe_session_id", session.id);

          // Increment use_count and disable if single_use
          const { data: link } = await supabaseAdmin
            .from("payment_links")
            .select("use_count, single_use, max_uses, title")
            .eq("id", linkId)
            .maybeSingle();

          if (link) {
            const newCount = (link.use_count || 0) + 1;
            const shouldDisable =
              link.single_use || (link.max_uses && newCount >= link.max_uses);
            await supabaseAdmin
              .from("payment_links")
              .update({
                use_count: newCount,
                last_paid_at: new Date().toISOString(),
                active: shouldDisable ? false : true,
              })
              .eq("id", linkId);
          }

          const recipientUserId = session.metadata?.recipient_user_id;
          if (recipientUserId) {
            await supabaseAdmin.from("notifications").insert({
              user_id: recipientUserId,
              title: "Payment received 💰",
              message: `${link?.title || "Payment link"} — paid via ThrivePay`,
              type: "payment",
              category: "payment",
              priority: "high",
              link: "/thrivepay",
            });
          }
          logStep("Payment link payment recorded", { linkId });
        }
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── Escrow milestone payment: authorization ──
      // Manual-capture escrow PaymentIntents reach `requires_capture` the
      // moment this Checkout Session completes. Previously nothing ever
      // observed that transition -- capture-milestone-payment only runs
      // later, when a human clicks "release" or "cancel", so a completed
      // escrow session left escrow_status stuck at 'none' indefinitely
      // (ESCROW_FLOW_AUDIT.md headline finding). This branch is the ONLY
      // place escrow_status moves from 'none' to 'authorized', and it
      // re-verifies the PaymentIntent's actual state with Stripe directly
      // rather than trusting the webhook payload, matching the verification
      // style capture-milestone-payment already uses for capture/cancel.
      if (kind === "milestone" && session.metadata?.useEscrow === "true" && session.payment_status === "paid") {
        const milestoneId = session.metadata?.milestoneId;
        const paymentIntentId = session.payment_intent as string;

        if (!milestoneId || !paymentIntentId) {
          logStep("Escrow authorization missing metadata", { milestoneId, paymentIntentId });
          return new Response(JSON.stringify({ received: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: escrowMilestone } = await supabaseAdmin
          .from("milestones")
          .select("id, title, project_id, created_by, escrow_status, status")
          .eq("id", milestoneId)
          .maybeSingle();

        if (!escrowMilestone) {
          logStep("Escrow milestone not found", { milestoneId });
          return new Response(JSON.stringify({ received: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Idempotent: covers webhook redelivery of this same event AND a
        // second completed session racing in after the first already
        // authorized (or after capture/cancel already moved it further).
        // Once escrow_status leaves 'none', this branch never writes again.
        if (escrowMilestone.escrow_status !== "none") {
          logStep("Escrow milestone already authorized/captured/cancelled, skipping", {
            milestoneId, existingEscrowStatus: escrowMilestone.escrow_status,
          });
          return new Response(JSON.stringify({ received: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Never trust session.payment_status alone for a state transition --
        // retrieve the PaymentIntent directly and confirm it actually holds
        // funds (requires_capture) before writing escrow_status='authorized'.
        const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (intent.status !== "requires_capture") {
          logStep("Escrow PaymentIntent not in requires_capture state, not authorizing", {
            milestoneId, paymentIntentId, actualStatus: intent.status,
          });
          return new Response(JSON.stringify({ received: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Compare-and-swap WHERE guard as a second, DB-level idempotency
        // barrier alongside the pre-check above (closes the race between
        // two concurrent deliveries of the same event).
        const { data: authUpdatedRows, error: authUpdateError } = await supabaseAdmin
          .from("milestones")
          .update({
            escrow_status: "authorized",
            payment_intent_id: paymentIntentId,
          })
          .eq("id", milestoneId)
          .eq("escrow_status", "none")
          .select("id");

        if (authUpdateError) {
          logStep("ERROR authorizing escrow milestone", { error: authUpdateError.message });
          throw authUpdateError;
        }

        if (!authUpdatedRows || authUpdatedRows.length === 0) {
          logStep("Escrow authorization lost the race to a concurrent update, skipping", { milestoneId });
          return new Response(JSON.stringify({ received: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        logStep("Escrow authorized -- funds held, awaiting capture", { milestoneId, paymentIntentId });

        try {
          const payerUserId = session.metadata?.userId;
          const escrowPayee = await resolveMilestonePayee(supabaseAdmin, escrowMilestone);
          if (escrowPayee.ambiguous) {
            logStep("WARNING: ambiguous milestone payee -- falling back to created_by", {
              milestoneId, candidateCount: escrowPayee.candidateCount,
            });
          }
          await supabaseAdmin.from("notifications").insert([
            {
              user_id: escrowPayee.payeeUserId,
              title: "Escrow funded 🔒",
              message: `Funds for "${escrowMilestone.title}" are now held in escrow, awaiting release.`,
              type: "payment",
              category: "payment",
              priority: "normal",
              link: `/desk/${escrowMilestone.project_id}?tab=finance`,
              action_url: `/desk/${escrowMilestone.project_id}?tab=finance`,
              action_text: "View milestone",
            },
            ...(payerUserId ? [{
              user_id: payerUserId,
              title: "Payment authorized ✓",
              message: `Your payment for "${escrowMilestone.title}" is held in escrow. It will only be released when you approve the work.`,
              type: "payment",
              category: "payment",
              priority: "normal",
              link: `/desk/${escrowMilestone.project_id}?tab=finance`,
              action_url: `/desk/${escrowMilestone.project_id}?tab=finance`,
              action_text: "View milestone",
            }] : []),
          ]);
        } catch (notifErr) {
          logStep("WARNING: escrow authorization notification failed", { error: String(notifErr) });
        }

        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── Milestone payment (non-escrow "Pay Now") ──
      if (kind === "milestone" && session.metadata?.useEscrow !== "true" && session.payment_status === "paid") {
        const milestoneId = session.metadata?.milestoneId;
        const paymentIntentId = session.payment_intent as string;

        if (!milestoneId || !paymentIntentId) {
          logStep("Milestone payment missing metadata", { milestoneId, paymentIntentId });
          return new Response(JSON.stringify({ received: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: milestone } = await supabaseAdmin
          .from("milestones")
          .select("*, projects(id, title)")
          .eq("id", milestoneId)
          .maybeSingle();

        if (!milestone) {
          logStep("Milestone not found", { milestoneId });
          return new Response(JSON.stringify({ received: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Idempotency -- guards both webhook redelivery of the same event
        // AND a second, genuinely-different completed session for a
        // milestone that's already paid (e.g. two tabs racing past the
        // create-milestone-payment guard before either had committed).
        // Once paid, no further session should touch this milestone.
        if (milestone.status === "paid") {
          logStep("Milestone already paid, skipping", { milestoneId, paymentIntentId, existingPaymentIntent: milestone.payment_intent_id });
          return new Response(JSON.stringify({ received: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const payee = await resolveMilestonePayee(supabaseAdmin, milestone);
        if (payee.ambiguous) {
          logStep("WARNING: ambiguous milestone payee -- falling back to created_by", {
            milestoneId, candidateCount: payee.candidateCount,
          });
        }

        await supabaseAdmin
          .from("milestones")
          .update({
            status: "paid",
            escrow_status: "none",
            payment_intent_id: paymentIntentId,
            paid_at: new Date().toISOString(),
            paid_to: payee.payeeUserId,
          })
          .eq("id", milestoneId);

        const talentRate = parseFloat(session.metadata?.talentRate || String(milestone.amount));
        const platformFee = parseFloat(session.metadata?.platformFee || "0");
        const managerCommission = parseFloat(session.metadata?.managerCommission || "0");
        const managerTableId = session.metadata?.managerTableId || null;
        const managerStripeAccountId = session.metadata?.managerStripeAccountId || null;
        const payerUserId = session.metadata?.userId;

        // Record + transfer manager commission, mirroring capture-milestone-payment.
        if (managerTableId && managerCommission > 0) {
          const { error: commissionError } = await supabaseAdmin
            .from("referral_commissions")
            .insert({
              manager_id: managerTableId,
              talent_user_id: payee.payeeUserId,
              source_type: "milestone",
              source_id: milestoneId,
              gross_amount: talentRate,
              commission_rate: 0.10,
              commission_amount: managerCommission,
              currency: "USD",
              status: managerStripeAccountId ? "paid" : "earned",
            });
          if (commissionError) {
            logStep("WARNING: Failed to record commission", { error: commissionError.message });
          }

          if (managerStripeAccountId) {
            try {
              const transfer = await stripe.transfers.create({
                amount: Math.round(managerCommission * 100),
                currency: "usd",
                destination: managerStripeAccountId,
                description: `Manager commission for milestone: ${milestone.title}`,
                metadata: { milestone_id: milestoneId, project_id: milestone.project_id, manager_table_id: managerTableId },
              });
              logStep("Commission transferred to manager", { transferId: transfer.id, amount: managerCommission });
              await supabaseAdmin.rpc("increment_manager_earnings" as any, {
                manager_id_input: managerTableId,
                amount_input: managerCommission,
              }).catch((err: any) => logStep("WARNING: Failed to update manager earnings", { error: String(err) }));
            } catch (transferErr) {
              logStep("WARNING: Failed to transfer commission to manager", { error: String(transferErr) });
              await supabaseAdmin
                .from("referral_commissions")
                .update({ status: "earned" })
                .eq("manager_id", managerTableId)
                .eq("source_id", milestoneId);
            }
          }
        }

        // Auto-generate invoice, mirroring capture-milestone-payment.
        try {
          const { data: payerProfile } = payerUserId
            ? await supabaseAdmin.from("profiles").select("full_name").eq("user_id", payerUserId).single()
            : { data: null };
          const { data: creatorProfile } = await supabaseAdmin
            .from("profiles")
            .select("full_name")
            .eq("user_id", payee.payeeUserId)
            .single();
          const { data: creatorAuth } = await supabaseAdmin.auth.admin.getUserById(payee.payeeUserId);

          const now = new Date();
          const lineItems = [
            { description: `Milestone: ${milestone.title}`, quantity: 1, rate: talentRate, amount: talentRate },
            ...(platformFee > 0 ? [{ description: "Kretopia Service Fee", quantity: 1, rate: platformFee, amount: platformFee }] : []),
            ...(managerCommission > 0 ? [{ description: "Talent Manager Commission", quantity: 1, rate: managerCommission, amount: managerCommission }] : []),
          ];

          const { error: invoiceError } = await supabaseAdmin.from("invoices").insert({
            invoice_number: `INV-${now.getFullYear()}-${now.getTime()}`,
            issued_by: payerUserId,
            issued_to: payee.payeeUserId,
            project_id: milestone.project_id,
            milestone_id: milestoneId,
            amount: talentRate + platformFee + managerCommission,
            currency: "USD",
            status: "paid",
            paid_at: now.toISOString(),
            brand_name: payerProfile?.full_name || "Client",
            recipient_name: creatorProfile?.full_name || "Creator",
            recipient_email: creatorAuth?.user?.email || null,
            payment_method: "stripe",
            payment_details: { payment_intent_id: paymentIntentId, escrow: false, auto_generated: true, talent_rate: talentRate, platform_fee: platformFee, manager_commission: managerCommission },
            line_items: lineItems,
            notes: `Auto-generated invoice for milestone "${milestone.title}".`,
          });
          if (invoiceError) logStep("WARNING: Failed to create auto-invoice", { error: invoiceError.message });
        } catch (invoiceErr) {
          logStep("WARNING: Auto-invoice generation failed", { error: String(invoiceErr) });
        }

        try {
          await supabaseAdmin.from("notifications").insert({
            user_id: payee.payeeUserId,
            title: "Payment received 💰",
            message: `$${talentRate.toFixed(2)} for "${milestone.title}" was paid on ${milestone.projects?.title || "your project"}.`,
            type: "payment",
            category: "payment",
            priority: "high",
            link: `/desk/${milestone.project_id}?tab=finance`,
            action_url: `/desk/${milestone.project_id}?tab=finance`,
            action_text: "View milestone",
          });
        } catch (notifErr) {
          logStep("WARNING: notification dispatch failed", { error: String(notifErr) });
        }

        try {
          await syncProjectStatusIfAllMilestonesPaid(supabaseAdmin, milestone.project_id);
        } catch (syncErr) {
          logStep("WARNING: project status sync failed", { error: String(syncErr) });
        }

        logStep("Milestone payment confirmed via webhook", { milestoneId, paymentIntentId });
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Only handle marketplace purchases from here
      if (session.metadata?.type !== 'marketplace_purchase') {
        logStep("Skipping non-marketplace session", { sessionId: session.id });
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (session.payment_status !== 'paid') {
        logStep("Payment not completed", { status: session.payment_status });
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const productId = session.metadata?.product_id;
      const buyerId = session.metadata?.buyer_id;
      const sellerId = session.metadata?.seller_id;
      const listingType = session.metadata?.listing_type || 'digital';

      if (!productId || !buyerId || !sellerId) {
        logStep("Missing metadata", { productId, buyerId, sellerId });
        return new Response("Missing metadata", { status: 400 });
      }

      // Check if order already exists
      const { data: existingOrder } = await supabaseAdmin
        .from('marketplace_orders')
        .select('id')
        .eq('checkout_session_id', session.id)
        .maybeSingle();

      if (existingOrder) {
        logStep("Order already exists", { orderId: existingOrder.id });
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Also check by payment_intent_id
      const { data: existingByPI } = await supabaseAdmin
        .from('marketplace_orders')
        .select('id')
        .eq('payment_intent_id', session.payment_intent as string)
        .maybeSingle();

      if (existingByPI) {
        logStep("Order already exists (by PI)", { orderId: existingByPI.id });
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get product details
      const { data: product } = await supabaseAdmin
        .from('digital_products')
        .select('*')
        .eq('id', productId)
        .single();

      if (!product) {
        logStep("Product not found", { productId });
        return new Response("Product not found", { status: 404 });
      }

      // Calculate auto-release date
      const autoReleaseDate = new Date();
      if (listingType === 'digital') {
        autoReleaseDate.setDate(autoReleaseDate.getDate() + 3);
      } else if (listingType === 'physical') {
        autoReleaseDate.setDate(autoReleaseDate.getDate() + 14);
      } else {
        autoReleaseDate.setDate(autoReleaseDate.getDate() + 7);
      }

      const deliveryStatus = listingType === 'digital' ? 'delivered' : 'pending';
      const orderStatus = listingType === 'digital' ? 'completed' : 'escrow';

      // Generate download URLs for digital products
      let downloadUrls: string[] = [];
      if (listingType === 'digital' && product.file_urls?.length > 0) {
        for (const filePath of product.file_urls) {
          const { data: signedData } = await supabaseAdmin
            .storage
            .from('product-files')
            .createSignedUrl(filePath, 60 * 60 * 24 * 7);
          if (signedData?.signedUrl) {
            downloadUrls.push(signedData.signedUrl);
          }
        }
        if (!downloadUrls.length) {
          downloadUrls = product.file_urls;
        }
      }

      // Create marketplace order
      const platformFeePercent = 0.15;
      const platformFee = product.price * platformFeePercent;

      const { data: order, error: orderError } = await supabaseAdmin
        .from('marketplace_orders')
        .insert({
          listing_id: productId,
          buyer_id: buyerId,
          seller_id: sellerId,
          listing_type: listingType,
          amount: product.price,
          platform_fee: platformFee,
          currency: product.currency || 'usd',
          status: orderStatus,
          payment_intent_id: session.payment_intent as string,
          checkout_session_id: session.id,
          delivery_status: deliveryStatus,
          delivered_at: listingType === 'digital' ? new Date().toISOString() : null,
          auto_release_at: autoReleaseDate.toISOString(),
          download_urls: downloadUrls.length > 0 ? downloadUrls : null,
        })
        .select()
        .single();

      if (orderError) {
        logStep("Error creating order", { error: orderError });
        return new Response("Failed to create order", { status: 500 });
      }

      logStep("Order created via webhook", { orderId: order.id, status: orderStatus });

      // Notify seller
      await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: sellerId,
          title: listingType === 'digital' ? 'New Sale! 💰' : 'New Order! 📦',
          message: `Someone purchased "${product.title}" for $${product.price}`,
          type: 'sale',
          category: 'sale',
          priority: 'high',
          link: '/orders',
        });

      // Update download count for digital
      if (listingType === 'digital') {
        await supabaseAdmin
          .from('digital_products')
          .update({ download_count: (product.download_count || 0) + 1 })
          .eq('id', productId);
      }

      logStep("Webhook processing complete", { orderId: order.id });
    } else if (event.type === "payment_intent.canceled") {
      // Stripe auto-cancels an uncaptured manual-capture PaymentIntent after
      // 7 days, and it can also be cancelled directly via the API/Dashboard --
      // neither goes through capture-milestone-payment's own 'cancel' action.
      // Without this, an expired escrow silently desyncs: Stripe shows the
      // hold released, the milestone still reads escrow_status='authorized'.
      try {
        const intent = event.data.object as Stripe.PaymentIntent;
        const milestoneId = intent.metadata?.milestoneId;

        if (milestoneId) {
          const { data: cancelledRows, error: cancelError } = await supabaseAdmin
            .from("milestones")
            .update({ escrow_status: "cancelled" })
            .eq("id", milestoneId)
            .eq("payment_intent_id", intent.id)
            .eq("escrow_status", "authorized")
            .select("id, title, project_id, created_by");

          if (cancelError) {
            logStep("ERROR handling payment_intent.canceled", { error: cancelError.message });
          } else if (cancelledRows && cancelledRows.length > 0) {
            const m = cancelledRows[0] as { id: string; title: string; project_id: string; created_by: string };
            logStep("Escrow cancelled via PaymentIntent cancellation/expiry", { milestoneId, paymentIntentId: intent.id });
            const cancelledPayee = await resolveMilestonePayee(supabaseAdmin, { created_by: m.created_by, project_id: m.project_id });
            if (cancelledPayee.ambiguous) {
              logStep("WARNING: ambiguous milestone payee -- falling back to created_by", {
                milestoneId, candidateCount: cancelledPayee.candidateCount,
              });
            }
            await supabaseAdmin.from("notifications").insert({
              user_id: cancelledPayee.payeeUserId,
              title: "Escrow cancelled",
              message: `The held payment for "${m.title}" was cancelled or expired before release.`,
              type: "payment",
              category: "payment",
              priority: "high",
              link: `/desk/${m.project_id}?tab=finance`,
            });
          } else {
            logStep("payment_intent.canceled: no matching authorized escrow milestone (already resolved, or not escrow)", { milestoneId, paymentIntentId: intent.id });
          }
        }
      } catch (cancelHandlerErr) {
        logStep("WARNING: payment_intent.canceled handling failed", { error: String(cancelHandlerErr) });
      }
    } else if (event.type === "payment_intent.payment_failed") {
      // Fires on e.g. a card decline. For the escrow path this can only
      // happen before checkout.session.completed ever fires, so
      // escrow_status is still 'none' by construction here -- there is
      // nothing to roll back. Logged for visibility only; deliberately no
      // DB write, matching the "don't invent unverified state" rule.
      const intent = event.data.object as Stripe.PaymentIntent;
      logStep("payment_intent.payment_failed received (no-op for escrow state)", {
        paymentIntentId: intent.id,
        milestoneId: intent.metadata?.milestoneId,
        lastPaymentError: intent.last_payment_error?.message,
      });
    } else if (event.type === "charge.refunded") {
      // A refund issued after capture (e.g. manually via the Stripe
      // Dashboard) has no representable terminal state in the current
      // escrow_status CHECK constraint ('none'|'authorized'|'captured'|
      // 'cancelled' -- 20251001071212_...sql). Writing 'cancelled' here
      // would be misleading: that value means "never captured" everywhere
      // else in this codebase. Rather than overload it or extend the
      // constraint speculatively, this is logged (the raw event is already
      // persisted via the stripe_webhook_events insert above) and flagged
      // for manual reconciliation. See ESCROW_WEBHOOK_IMPLEMENTATION_REPORT.md
      // "Known gap: refunds and disputes".
      try {
        const charge = event.data.object as Stripe.Charge;
        logStep("charge.refunded received -- manual reconciliation required, no automatic DB write", {
          chargeId: charge.id, paymentIntentId: charge.payment_intent,
        });
        const { data: refundedMilestone } = await supabaseAdmin
          .from("milestones")
          .select("id, title, project_id, created_by")
          .eq("payment_intent_id", charge.payment_intent as string)
          .maybeSingle();
        if (refundedMilestone) {
          const refundedPayee = await resolveMilestonePayee(supabaseAdmin, refundedMilestone);
          if (refundedPayee.ambiguous) {
            logStep("WARNING: ambiguous milestone payee -- falling back to created_by", {
              milestoneId: refundedMilestone.id, candidateCount: refundedPayee.candidateCount,
            });
          }
          await supabaseAdmin.from("notifications").insert({
            user_id: refundedPayee.payeeUserId,
            title: "Refund issued — needs review",
            message: `A refund was issued for "${refundedMilestone.title}". Please verify this milestone's status manually.`,
            type: "alert",
            category: "payment",
            priority: "high",
            link: `/desk/${refundedMilestone.project_id}?tab=finance`,
          });
        }
      } catch (refundErr) {
        logStep("WARNING: charge.refunded handling failed", { error: String(refundErr) });
      }
    } else if (event.type === "charge.dispute.created") {
      // Same reasoning as charge.refunded above -- no DB state machine
      // support for 'disputed' today. Logged + a high-priority manual-review
      // notification; does not touch milestone rows.
      try {
        const dispute = event.data.object as Stripe.Dispute;
        logStep("charge.dispute.created received -- manual review required", {
          disputeId: dispute.id, chargeId: dispute.charge,
        });
        const charge = await stripe.charges.retrieve(dispute.charge as string);
        const { data: disputedMilestone } = await supabaseAdmin
          .from("milestones")
          .select("id, title, project_id, created_by")
          .eq("payment_intent_id", charge.payment_intent as string)
          .maybeSingle();
        if (disputedMilestone) {
          const disputedPayee = await resolveMilestonePayee(supabaseAdmin, disputedMilestone);
          if (disputedPayee.ambiguous) {
            logStep("WARNING: ambiguous milestone payee -- falling back to created_by", {
              milestoneId: disputedMilestone.id, candidateCount: disputedPayee.candidateCount,
            });
          }
          await supabaseAdmin.from("notifications").insert({
            user_id: disputedPayee.payeeUserId,
            title: "Payment disputed — needs review",
            message: `A dispute was filed for "${disputedMilestone.title}". Please review immediately.`,
            type: "alert",
            category: "payment",
            priority: "high",
            link: `/desk/${disputedMilestone.project_id}?tab=finance`,
          });
        }
      } catch (disputeErr) {
        logStep("WARNING: charge.dispute.created handling failed", { error: String(disputeErr) });
      }
    } else if (event.type === "transfer.reversed") {
      // Reconciliation hook for the manager-commission transfer ledger
      // (see ESCROW_TRANSFER_IDEMPOTENCY_REPORT.md). A reversed transfer
      // means Stripe pulled the commission back -- mark the ledger row so it
      // surfaces in the reconciliation query instead of reading as
      // 'completed' forever. Wrapped in try/catch: the ledger table is a
      // prepared-not-applied migration as of this pass, so this must not
      // crash the whole webhook handler if it doesn't exist yet.
      try {
        const transfer = event.data.object as Stripe.Transfer;
        const { error: reversalError } = await supabaseAdmin
          .from("milestone_commission_transfers")
          .update({ status: "reversed" })
          .eq("stripe_transfer_id", transfer.id);
        if (reversalError) {
          logStep("WARNING: failed to mark commission transfer reversed", { error: reversalError.message, transferId: transfer.id });
        } else {
          logStep("Commission transfer marked reversed", { transferId: transfer.id });
        }
      } catch (reversalHandlerErr) {
        logStep("WARNING: transfer.reversed handling failed", { error: String(reversalHandlerErr) });
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    logStep("ERROR", { message: String(error) });
    return new Response(JSON.stringify({ error: String(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
