import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { EscrowAuthError } from "../_shared/escrowAuth.ts";
import { resolveStripeSecretKey } from "../_shared/stripeEnv.ts";
import { resolveMilestonePayee } from "../_shared/resolveMilestonePayee.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[BATCH-PAYOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

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
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { projectId, milestoneIds } = await req.json();
    if (!projectId || !milestoneIds?.length) {
      throw new Error("Missing projectId or milestoneIds");
    }

    logStep("Batch payout request", { projectId, count: milestoneIds.length });

    // --- Authorization: only the project's paying client or owner may release funds ---
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('id, created_by, client_user_id')
      .eq('id', projectId)
      .maybeSingle();
    if (!project) throw new EscrowAuthError("Project not found", 404);
    const authorizedPayers = [project.client_user_id, project.created_by].filter(Boolean);
    if (!authorizedPayers.includes(user.id)) {
      throw new EscrowAuthError("You are not authorized to release payments for this project");
    }
    logStep("Authorization passed", { userId: user.id, projectId });

    // Fetch all eligible milestones
    const { data: milestones, error: fetchError } = await supabaseAdmin
      .from('milestones')
      .select('*, projects(id, title, created_by)')
      .in('id', milestoneIds)
      .eq('project_id', projectId);

    if (fetchError) throw new Error(`Failed to fetch milestones: ${fetchError.message}`);
    if (!milestones?.length) throw new Error("No eligible milestones found");

    // Filter to only completable milestones (completed status, no escrow, not yet paid)
    const payable = milestones.filter(m => 
      m.status === 'completed' && m.escrow_status === 'none' && !m.paid_at
    );

    // Also handle escrow-authorized milestones (capture them)
    const capturable = milestones.filter(m => 
      m.escrow_status === 'authorized' && m.payment_intent_id && m.status === 'review'
    );

    logStep("Eligible milestones", { payable: payable.length, capturable: capturable.length });

    const stripe = new Stripe(resolveStripeSecretKey(), {
      apiVersion: "2025-08-27.basil",
    });

    const results: any[] = [];
    const now = new Date();

    // 1) Capture escrow-authorized milestones
    for (const milestone of capturable) {
      try {
        logStep("Capturing escrow", { milestoneId: milestone.id });
        await stripe.paymentIntents.capture(milestone.payment_intent_id);

        // Who actually gets paid -- NOT necessarily milestone.created_by.
        // See _shared/resolveMilestonePayee.ts.
        const payee = await resolveMilestonePayee(supabaseAdmin, milestone);
        if (payee.ambiguous) {
          logStep("WARNING: ambiguous milestone payee -- falling back to created_by", {
            milestoneId: milestone.id, candidateCount: payee.candidateCount,
          });
        }

        await supabaseAdmin
          .from('milestones')
          .update({
            status: 'paid',
            escrow_status: 'captured',
            paid_at: now.toISOString(),
            paid_to: payee.payeeUserId,
          })
          .eq('id', milestone.id);

        // Auto-generate invoice
        await generateInvoice(supabaseAdmin, milestone, payee.payeeUserId, user.id, now);

        results.push({ id: milestone.id, status: 'captured', success: true });
      } catch (err: any) {
        logStep("ERROR capturing", { milestoneId: milestone.id, error: err.message });
        results.push({ id: milestone.id, status: 'error', error: err.message });
      }
    }

    // 2) For completed (non-escrow) milestones, create a single combined checkout session
    if (payable.length > 0) {
      const totalCents = payable.reduce((sum, m) => sum + Math.round(m.amount * 100), 0);
      
      const lineItems = payable.map(m => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Milestone: ${m.title}`,
            description: `Batch payment for project milestone`,
          },
          unit_amount: Math.round(m.amount * 100),
        },
        quantity: 1,
      }));

      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      const customerId = customers.data.length > 0 ? customers.data[0].id : undefined;

      const origin = req.headers.get("origin") || "https://www.thrivein.io";
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: lineItems,
        mode: "payment",
        success_url: `${origin}/desk/${projectId}?payment=success&batch=true`,
        cancel_url: `${origin}/desk/${projectId}?payment=cancelled`,
        metadata: {
          batch: 'true',
          projectId,
          milestoneIds: payable.map(m => m.id).join(','),
          userId: user.id,
        },
      });

      logStep("Batch checkout session created", { sessionId: session.id, total: totalCents / 100, count: payable.length });

      results.push(...payable.map(m => ({ id: m.id, status: 'checkout_pending', success: true })));

      return new Response(JSON.stringify({
        success: true,
        url: session.url,
        sessionId: session.id,
        results,
        summary: {
          captured: capturable.length,
          checkoutItems: payable.length,
          totalCheckout: totalCents / 100,
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Only escrow captures, no checkout needed
    return new Response(JSON.stringify({
      success: true,
      results,
      summary: {
        captured: results.filter(r => r.status === 'captured').length,
        errors: results.filter(r => r.status === 'error').length,
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const status = error instanceof EscrowAuthError ? error.status : 500;
    logStep("ERROR", { message: errorMessage, status });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});

async function generateInvoice(supabaseAdmin: any, milestone: any, payeeUserId: string, payerUserId: string, now: Date) {
  try {
    const { data: payerProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('user_id', payerUserId)
      .single();

    const { data: creatorProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('user_id', payeeUserId)
      .single();

    const { data: creatorAuth } = await supabaseAdmin.auth.admin.getUserById(payeeUserId);

    const invoiceNumber = `INV-${now.getFullYear()}-${now.getTime()}-${milestone.id.slice(0, 4)}`;

    await supabaseAdmin.from('invoices').insert({
      invoice_number: invoiceNumber,
      issued_by: payerUserId,
      issued_to: payeeUserId,
      project_id: milestone.project_id,
      milestone_id: milestone.id,
      amount: milestone.amount,
      currency: 'USD',
      status: 'paid',
      paid_at: now.toISOString(),
      brand_name: payerProfile?.full_name || 'Client',
      recipient_name: creatorProfile?.full_name || 'Creator',
      recipient_email: creatorAuth?.user?.email || null,
      payment_method: 'stripe_escrow',
      payment_details: {
        payment_intent_id: milestone.payment_intent_id,
        escrow: true,
        auto_generated: true,
        batch: true,
      },
      line_items: [{
        description: `Milestone: ${milestone.title}`,
        quantity: 1,
        rate: milestone.amount,
        amount: milestone.amount,
      }],
      notes: `Auto-generated invoice for milestone "${milestone.title}" on project "${milestone.projects?.title || 'Project'}". Batch payout via ThrivePay.`,
    });

    logStep("Invoice generated for milestone", { milestoneId: milestone.id });
  } catch (err) {
    logStep("WARNING: Invoice generation failed", { milestoneId: milestone.id, error: String(err) });
  }
}
