import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Zap, Crown, Briefcase, User, Check } from "lucide-react";
import {
  SUBSCRIPTION_PRODUCTS,
  type AccountType, type BillingInterval,
} from "@/lib/subscriptionConfig";
import { getCreatorPlans, getBrandPlans, type PlanCard } from "@/lib/subscriptionPlans";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { StudioFeatureShell } from "@/components/studio-reference/StudioFeatureShell";
import { HoloCard } from "@/components/passport/HoloCard";
import { cn } from "@/lib/utils";
import type { TutorialStep } from "@/components/landing/kretopia/FeatureTutorial";

const SUBSCRIPTION_TUTORIAL: TutorialStep[] = [
  { icon: Zap, title: "Start free", body: "Spark is free forever — no credit card, no time limit. Upgrade only when you're ready for more." },
  { icon: Sparkles, title: "Try Pro risk-free", body: "Monthly plans start with a 7-day free trial, and every plan cancels anytime." },
  { icon: Crown, title: "Manage it anytime", body: "Once you're subscribed, open Manage Subscription here to update your card, change plans, or cancel." },
];

export default function Subscription() {
  const [loading, setLoading] = useState<string | null>(null);
  const [currentTier, setCurrentTier] = useState<string>("free");
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>("none");
  const [accountType, setAccountType] = useState<AccountType>("individual");
  const [viewMode, setViewMode] = useState<"creator" | "brand">("creator");
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [checkingSubscription, setCheckingSubscription] = useState(true);
  const [founderSpotsTaken, setFounderSpotsTaken] = useState(0);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkSubscription();
    fetchFounderCount();
  }, []);

  useEffect(() => {
    if (!checkingSubscription) {
      if (accountType === "company") setViewMode("brand");
      const trackPaywall = async () => {
        const { analytics } = await import("@/lib/analytics");
        analytics.paywallViewed('subscription_page', currentTier);
      };
      trackPaywall();
    }
  }, [checkingSubscription, currentTier, accountType]);

  const fetchFounderCount = async () => {
    try {
      const { data, error } = await supabase.rpc('get_founder_circle_count');
      if (!error && data !== null) setFounderSpotsTaken(data);
    } catch (e) {
      console.error("Error fetching founder count:", e);
    }
  };

  const checkSubscription = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_tier, subscription_product_id, subscription_status, account_type")
        .eq("user_id", session.user.id)
        .single();

      if (profile?.subscription_tier) setCurrentTier(profile.subscription_tier);
      if (profile?.subscription_status) setSubscriptionStatus(profile.subscription_status);
      if (profile?.account_type) setAccountType(profile.account_type as AccountType);
    } catch (error: any) {
      console.error("Error checking subscription:", error);
    } finally {
      setCheckingSubscription(false);
    }
  };

  const handleSubscribe = async (priceId: string | null, tier: string) => {
    if (!priceId) {
      toast({ title: "Free Tier", description: "You're already on the free tier" });
      return;
    }

    const { analytics } = await import("@/lib/analytics");
    analytics.checkoutAttempt(tier, priceId);

    try {
      setLoading(priceId);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Authentication required", description: "Please sign in to subscribe", variant: "destructive" });
        navigate("/auth");
        return;
      }

      // The server resolves the actual (test- or live-mode) Stripe Price ID
      // from `tier` + `interval` — it never trusts a client-supplied Price
      // ID, since the frontend has no visibility into which Stripe mode the
      // backend is running in (see supabase/functions/_shared/subscriptionPrices.ts).
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { tier, interval: billingInterval },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create checkout session", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const handleFounderCheckout = async () => {
    try {
      setLoading("founder");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Authentication required", description: "Please sign in first", variant: "destructive" });
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-founder-checkout");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to start checkout", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setLoading("portal");
      const { analytics } = await import("@/lib/analytics");
      analytics.customerPortalOpened();
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to open customer portal", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const confirmPlan = (plan: PlanCard) => {
    if (plan.isFounder) {
      handleFounderCheckout();
    } else {
      handleSubscribe(plan.priceId, plan.tier);
    }
  };

  if (checkingSubscription) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  const founderSpotsRemaining = SUBSCRIPTION_PRODUCTS.founder.maxSpots - founderSpotsTaken;
  const isFounder = currentTier === 'founder';
  const hasPaidSub = currentTier !== "free" && (subscriptionStatus === "active" || subscriptionStatus === "trialing") && currentTier !== "founder";
  const plans = viewMode === "brand" ? getBrandPlans(billingInterval) : getCreatorPlans(billingInterval, founderSpotsRemaining);

  const isCurrentPlan = (plan: PlanCard) => (plan.isFounder ? isFounder : plan.tier === currentTier);
  const isPlanLoading = (plan: PlanCard) => loading !== null && loading === (plan.isFounder ? "founder" : plan.priceId);

  return (
    <div className="min-h-screen">
      <FeaturePageHeader
        eyebrow="Pricing"
        title="Choose your"
        accentTitle="plan."
        subtitle={
          viewMode === "brand"
            ? "Find, hire & manage top creative talent."
            : "Unlock the full potential of Kretopia."
        }
        tutorial={{ featureKey: "subscription", label: "How Pricing works", steps: SUBSCRIPTION_TUTORIAL }}
        tabs={
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card/80 backdrop-blur-sm text-xs font-semibold text-muted-foreground">
              {viewMode === "brand" ? (
                <><Briefcase className="h-3.5 w-3.5" /> Brand plans</>
              ) : (
                <><User className="h-3.5 w-3.5" /> Creator plans</>
              )}
            </div>

            <div className="flex items-center justify-center gap-3">
              <Label htmlFor="billing-toggle" className={cn("text-sm", billingInterval === 'monthly' ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                Monthly
              </Label>
              <Switch
                id="billing-toggle"
                checked={billingInterval === 'yearly'}
                onCheckedChange={(checked) => setBillingInterval(checked ? 'yearly' : 'monthly')}
              />
              <Label htmlFor="billing-toggle" className={cn("text-sm", billingInterval === 'yearly' ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                Yearly
              </Label>
              {billingInterval === 'yearly' && (
                <Badge
                  variant="secondary"
                  className="text-xs border"
                  style={{
                    backgroundColor: "hsl(var(--energy) / 0.1)",
                    color: "hsl(var(--energy))",
                    borderColor: "hsl(var(--energy) / 0.3)",
                  }}
                >
                  Save up to 17%
                </Badge>
              )}
            </div>
          </div>
        }
      />

      <StudioFeatureShell>
        {hasPaidSub && (
          <div className="flex justify-end">
            <Button size="sm" onClick={handleManageSubscription} variant="outline" disabled={loading === "portal"}>
              {loading === "portal" ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading...</>
              ) : (
                "Manage Subscription"
              )}
            </Button>
          </div>
        )}

        <div
          className={cn(
            "grid grid-cols-1 gap-6 items-stretch mx-auto",
            plans.length >= 4 ? "sm:grid-cols-2 lg:grid-cols-4 max-w-6xl" : "sm:grid-cols-3 max-w-5xl",
          )}
        >
          {plans.map((plan) => {
            const Icon = plan.icon;
            const current = isCurrentPlan(plan);
            const showFounderProgress = plan.isFounder && SUBSCRIPTION_PRODUCTS.founder.maxSpots > 0;
            const founderPct = showFounderProgress
              ? (founderSpotsTaken / SUBSCRIPTION_PRODUCTS.founder.maxSpots) * 100
              : 0;

            return (
              <HoloCard key={plan.tier} className="h-full">
                <div
                  className={cn(
                    "relative flex h-full flex-col rounded-2xl border bg-card p-5 sm:p-6",
                    plan.popular || current ? "border-[hsl(var(--energy))]" : "border-border",
                  )}
                >
                  {plan.popular && !current && (
                    <Badge
                      className="absolute top-3 right-3 border-transparent text-white"
                      style={{ backgroundColor: "hsl(var(--energy))" }}
                    >
                      Most Popular
                    </Badge>
                  )}
                  {current && (
                    <Badge
                      className="absolute top-3 right-3 border-transparent text-white"
                      style={{ backgroundColor: "hsl(var(--energy))" }}
                    >
                      Your Plan
                    </Badge>
                  )}

                  <Icon className="h-6 w-6 mb-3 shrink-0" style={{ color: "hsl(var(--energy))" }} aria-hidden />
                  <h3 className="text-lg font-bold text-foreground leading-tight">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">{plan.tagline}</p>

                  <div className="mb-5">
                    <span className="text-3xl font-black text-foreground">{plan.displayPrice}</span>
                    {!plan.oneTime && plan.price > 0 && <span className="text-sm text-muted-foreground ml-1">/mo</span>}
                    {plan.oneTime && <span className="text-sm text-muted-foreground ml-1">one-time</span>}
                  </div>

                  {showFounderProgress && (
                    <div className="mb-5">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>{founderSpotsTaken} claimed</span>
                        <span>{SUBSCRIPTION_PRODUCTS.founder.maxSpots} total</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${founderPct}%`, backgroundColor: "hsl(var(--energy))" }}
                        />
                      </div>
                    </div>
                  )}

                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-foreground/80">
                        <Check className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "hsl(var(--energy))" }} aria-hidden />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => confirmPlan(plan)}
                    disabled={current || plan.soldOut || isPlanLoading(plan)}
                    variant={plan.popular ? "default" : "outline"}
                    className="w-full mt-auto"
                    style={plan.popular ? { backgroundColor: "hsl(var(--energy))", borderColor: "hsl(var(--energy))" } : undefined}
                  >
                    {current ? (
                      "Current Plan"
                    ) : plan.soldOut ? (
                      "Sold Out"
                    ) : isPlanLoading(plan) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      plan.ctaLabel
                    )}
                  </Button>
                </div>
              </HoloCard>
            );
          })}
        </div>

        {viewMode === "brand" && (
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-sm text-muted-foreground mb-2">
              Brand subscriptions are separate from creator plans. You can have both active simultaneously.
            </p>
            <p className="text-xs text-muted-foreground">
              Creators receive 100% of their rate. Service fees are charged to your brand on top.
            </p>
          </div>
        )}

        <div className="text-center text-sm text-muted-foreground">
          <p>Free forever to start · Cancel anytime · Secure payments · 24/7 support</p>
          <p className="mt-2">Save 17% with annual billing · No hidden fees</p>
        </div>
      </StudioFeatureShell>
    </div>
  );
}
