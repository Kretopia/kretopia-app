import { Link } from "react-router-dom";
import { ArrowUpRight, Award, CheckCircle, MapPin, Shield, ShieldCheck, Star } from "lucide-react";
import { HoloCard } from "@/components/passport/HoloCard";
import type { ProfileRow } from "./today.types";

interface TodayMiniPassportProps {
  profile: ProfileRow;
  creditCount: number;
  completion: number;
}

/** Same three tiers/labels/icons as ShareableProfileCard's own badge --
 *  one vocabulary for "what verified means" wherever a Passport is
 *  previewed, not a second one invented for this card. */
function verificationBadge(tier: string | null | undefined) {
  switch (tier) {
    case "elite": return { icon: Award, label: "Elite Verified", color: "text-amber-400" };
    case "industry": return { icon: Shield, label: "Industry Verified", color: "text-primary" };
    case "verified": return { icon: CheckCircle, label: "Verified", color: "text-emerald-400" };
    default: return null;
  }
}

export function TodayMiniPassport({ profile, creditCount, completion }: TodayMiniPassportProps) {
  const skills = [...readLabels(profile.professional_skills), ...readLabels(profile.passion_skills)].slice(0, 3);
  const displayName = profile.full_name || profile.username || "Kretopia Creator";
  const profession = profile.passport_profession || profile.job_title || profile.role || "Creator";
  const badge = verificationBadge(profile.verification_tier);
  const hasRating = (profile.total_reviews || 0) > 0 && typeof profile.average_rating === "number";

  return (
    <Link to="/passport" className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl" aria-label="Open my Creative Passport">
      <HoloCard className="h-full" maxTilt={5}>
        <article className="relative min-h-[210px] h-full overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-5">
          {profile.cover_image_url ? (
            <img src={profile.cover_image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-br from-background/95 via-background/85 to-primary/20" aria-hidden />
          <div className="relative z-[2] flex h-full flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg font-black text-muted-foreground">{displayName.charAt(0)}</div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">My Creative Passport</p>
                  <h2 className="truncate text-lg font-black text-foreground">{displayName}</h2>
                  <p className="truncate text-xs text-muted-foreground">{profession}</p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                {badge && (
                  <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide whitespace-nowrap ${badge.color}`}>
                    <badge.icon className="h-3 w-3" />
                    {badge.label}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-auto pt-5">
              {skills.length > 0 ? (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {skills.map((skill) => <span key={skill} className="rounded-full border border-border bg-background/70 px-2 py-1 text-[10px] font-semibold text-foreground">{skill}</span>)}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                {profile.location ? <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{profile.location}</span> : null}
                <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-primary" />{creditCount} credit{creditCount === 1 ? "" : "s"}</span>
                {hasRating && (
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3 w-3 fill-current text-amber-400" />
                    {profile.average_rating!.toFixed(1)} ({profile.total_reviews})
                  </span>
                )}
                <span className="ml-auto font-bold text-foreground">{completion}% complete</span>
              </div>
            </div>
          </div>
        </article>
      </HoloCard>
    </Link>
  );
}

function readLabels(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => typeof item === "string" ? [item] : item && typeof item === "object" && "name" in item && typeof item.name === "string" ? [item.name] : []);
  }
  if (value && typeof value === "object") return Object.keys(value);
  return [];
}

export default TodayMiniPassport;