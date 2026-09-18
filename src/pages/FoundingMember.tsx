import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CardCarousel } from "@/components/kretopia/CardCarousel";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SEO } from "@/components/SEO";
import Confetti from "react-dom-confetti";
import { Star, CheckCircle2, ArrowLeft, Trophy, Calendar, ListChecks, Sparkles } from "lucide-react";
import { useFoundingMemberProgress } from "@/hooks/useFoundingMemberProgress";
import { FOUNDING_QUESTS, FOUNDING_MEMBER_CAP, foundingDeadlineLabel, foundingDaysLeft } from "@/lib/foundingMember";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { StudioFeatureShell } from "@/components/studio-reference/StudioFeatureShell";
import { HoloCard } from "@/components/passport/HoloCard";
import { KretoCharacter } from "@/components/brand/KretoCharacter";
import type { TutorialStep } from "@/components/landing/kretopia/FeatureTutorial";

const FOUNDING_TUTORIAL: TutorialStep[] = [
  { icon: ListChecks, title: "Complete 3 milestones", body: "Verify your profile, log a credit, and invite a friend — each one moves your progress bar." },
  { icon: Star, title: "Race for one of 100 spots", body: "Only 100 Founding Member badges exist. First 100 to finish all 3 milestones get one." },
  { icon: Trophy, title: "Wear it on your Passport", body: "Once earned, the badge is permanent and shows on your public Passport as an early member." },
];

const QUEST_CTA: Record<string, { label: string; to: string }> = {
  claim_profile: { label: "Verify profile", to: "/profile" },
  log_credits: { label: "Add a credit", to: "/profile" },
  invite_signups: { label: "Invite friends", to: "/profile?tab=invite" },
};

// Same recipe as NewRoomLaunchScreen's own celebration: three confetti
// emitters across the top of the viewport, one hsl(var(--energy))-based
// config -- one visual language for "you just earned something" across
// the app, not a bespoke one invented per feature.
const confettiConfig = {
  angle: 90,
  spread: 280,
  startVelocity: 55,
  elementCount: 140,
  dragFriction: 0.1,
  duration: 5000,
  stagger: 2,
  width: "10px",
  height: "10px",
  colors: ["hsl(var(--energy))", "#ffffff", "hsl(var(--energy) / 0.6)", "hsl(var(--accent))"],
};

export default function FoundingMember() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { loading, progress, completedCount, allComplete, badgeAwarded } = useFoundingMemberProgress();
  const [showConfetti, setShowConfetti] = useState(false);

  const total = FOUNDING_QUESTS.length;
  const pct = Math.round((completedCount / total) * 100);
  const deadline = foundingDeadlineLabel();
  const daysLeft = foundingDaysLeft();
  const urgent = daysLeft <= 14;

  // Fires once, the moment all 3 milestones are already complete on
  // arrival or become complete live -- never replays on every render.
  useEffect(() => {
    if (!allComplete) { setShowConfetti(false); return; }
    const t = setTimeout(() => setShowConfetti(true), 250);
    return () => clearTimeout(t);
  }, [allComplete]);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Founding Member — Kretopia"
        description="Earn one of 100 Founding Member badges by completing 3 short milestones."
      />

      <FeaturePageHeader
        eyebrow="Founding Circle"
        title="Founding Circle."
        accentTitle="100 spots, one badge."
        subtitle="Complete 3 milestones before the deadline and earn a permanent Founding Member badge."
        tutorial={{ featureKey: "founding-circle", label: "How the Founding Circle works", steps: FOUNDING_TUTORIAL }}
      />

      <StudioFeatureShell>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[hsl(var(--energy))] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        {/* Hero — the badge itself, as a real Passport-grade medallion
            (same HoloCard treatment as the owner Passport / New Room's
            celebration) instead of a plain card. Only 100 of these ever
            exist, so the one place that shows it off gets the one
            dominant, imagery-rich treatment instead of a muted progress
            bar. */}
        <HoloCard maxTilt={6} className="mt-3">
          <div className={cn(
            "relative overflow-hidden rounded-2xl border border-border bg-card p-6 text-center",
            (allComplete || badgeAwarded) && "shadow-glow",
          )}>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ background: "radial-gradient(65% 60% at 50% 0%, hsl(var(--energy) / 0.16), transparent 65%)" }}
            />
            <div className="absolute top-0 left-1/4 z-10"><Confetti active={showConfetti} config={confettiConfig} /></div>
            <div className="absolute top-0 left-1/2 z-10"><Confetti active={showConfetti} config={confettiConfig} /></div>
            <div className="absolute top-0 left-3/4 z-10"><Confetti active={showConfetti} config={confettiConfig} /></div>

            <div className="relative">
              <div
                className={cn(
                  "mx-auto h-24 w-24 rounded-full flex items-center justify-center border-2 bg-gradient-to-br transition-all",
                  badgeAwarded
                    ? "from-[hsl(var(--energy)/0.3)] via-accent/20 to-[hsl(var(--energy)/0.05)] border-[hsl(var(--energy))] shadow-glow"
                    : allComplete
                      ? "from-[hsl(var(--energy)/0.22)] to-[hsl(var(--energy)/0.05)] border-[hsl(var(--energy)/0.7)]"
                      : "from-muted/40 to-muted/10 border-border",
                )}
              >
                <Trophy className={cn("h-11 w-11", (allComplete || badgeAwarded) ? "text-[hsl(var(--energy))]" : "text-muted-foreground")} />
              </div>

              <p className="mt-4 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "hsl(var(--energy))" }}>
                <Sparkles className="h-3 w-3" aria-hidden />
                {FOUNDING_MEMBER_CAP} badges. Ever.
              </p>

              <p className="mt-2 text-xl font-black tracking-[-0.02em]">
                {badgeAwarded
                  ? "Your badge is live."
                  : allComplete
                    ? "You earned it."
                    : `${completedCount} of ${total} milestones complete`}
              </p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                {badgeAwarded
                  ? "Permanently on your public Passport, as one of Kretopia's first 100 members."
                  : allComplete
                    ? "All 3 milestones complete — your badge will appear on your profile shortly."
                    : "Finish all 3 to claim a permanent Founding Member badge on your Passport."}
              </p>

              <div className="mt-5 max-w-xs mx-auto space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-muted-foreground">{completedCount} of {total} completed</span>
                  <span className="text-foreground">{pct}%</span>
                </div>
                <Progress value={pct} className="h-2" />
              </div>

              <div
                className={cn(
                  "mt-4 inline-flex items-center gap-1.5 text-xs rounded-full px-3 py-1 border",
                  urgent && !badgeAwarded ? "text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.08)]" : "text-muted-foreground border-border bg-card",
                )}
              >
                <Calendar className="h-3 w-3" />
                Closes {deadline} · {daysLeft} day{daysLeft === 1 ? "" : "s"} left
              </div>

              {(allComplete || badgeAwarded) && (
                <div>
                  <Button
                    size="sm"
                    className="mt-4 gap-1.5"
                    onClick={() => navigate(user ? "/profile" : "/auth")}
                  >
                    View my profile
                  </Button>
                </div>
              )}
            </div>

            {/* Kreto, front and center for the win -- same mascot presence
                New Room's celebration and Today use, here specifically
                once there's something to celebrate. */}
            {(allComplete || badgeAwarded) && (
              <div className="absolute right-2 bottom-0 hidden sm:block opacity-90 pointer-events-none" aria-hidden>
                <KretoCharacter variant="main" size={110} floatAmplitude={3} floatDuration={8} />
              </div>
            )}
          </div>
        </HoloCard>

        {/* Quest cards */}
        <CardCarousel label="Milestones" itemClassName="basis-[88%] sm:basis-1/2">
          {FOUNDING_QUESTS.map((quest, i) => {
            const p = progress[quest.key];
            const cta = QUEST_CTA[quest.key];
            const questPct = Math.round((p.current / p.target) * 100);
            return (
              <Card
                key={quest.key}
                className={cn(
                  "p-4 transition-colors",
                  p.completed && "border-[hsl(var(--energy)/0.4)] bg-[hsl(var(--energy)/0.04)]",
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold border-2",
                      p.completed
                        ? "bg-[hsl(var(--energy))] border-[hsl(var(--energy))] text-white shadow-glow"
                        : "bg-muted border-border text-muted-foreground",
                    )}
                  >
                    {p.completed ? <CheckCircle2 className="h-5 w-5" /> : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-sm leading-snug">{quest.title}</p>
                      <span
                        className={cn("text-xs font-mono shrink-0", p.completed ? "text-[hsl(var(--energy))]" : "text-muted-foreground")}
                      >
                        {p.current}/{p.target}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{quest.description}</p>
                    <div className="mt-2.5">
                      <Progress value={questPct} className="h-1.5" />
                    </div>
                    {!p.completed && cta && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 h-8 text-xs"
                        onClick={() => navigate(cta.to)}
                      >
                        {cta.label}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </CardCarousel>

        {loading && (
          <p className="text-xs text-muted-foreground text-center mt-4">Checking your progress…</p>
        )}
      </StudioFeatureShell>
    </div>
  );
}
