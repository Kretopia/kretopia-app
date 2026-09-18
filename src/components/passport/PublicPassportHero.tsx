import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FramedAvatar } from "@/components/ui/framed-avatar";
import { HoloCard } from "./HoloCard";
import { AvailabilityIndicator } from "@/components/profile/AvailabilityIndicator";
import { TrustSignals } from "@/components/profile/TrustSignals";
import { cn } from "@/lib/utils";
import {
  Calendar,
  CheckCircle2,
  ExternalLink,
  Fingerprint,
  FolderPlus,
  Globe,
  Handshake,
  Instagram,
  Linkedin,
  MapPin,
  MessageCircle,
  Music,
  Share2,
  Twitter,
  UserPlus,
  Youtube,
} from "lucide-react";

interface PublicPassportProfile {
  user_id: string;
  full_name: string;
  username?: string | null;
  avatar_url?: string | null;
  profile_frame?: string | null;
  cover_image_url?: string | null;
  verification_status?: string | null;
  job_title?: string | null;
  role?: string | null;
  location?: string | null;
  availability_status?: string | null;
  availability?: string | null;
  availability_note?: string | null;
  sub_roles?: string[] | null;
  bio?: string | null;
  email_verified?: boolean;
  phone_verified?: boolean;
  id_verified?: boolean;
  payment_verified?: boolean;
  professional_skills?: unknown;
  instagram_url?: string | null;
  linkedin_url?: string | null;
  twitter_url?: string | null;
  youtube_url?: string | null;
  spotify_url?: string | null;
  website?: string | null;
  calendly_url?: string | null;
}

interface PublicPassportHeroProps {
  profile: PublicPassportProfile;
  credits: Array<{ project_name?: string; title?: string; role: string; verification_status?: string; isVerified?: boolean }>;
  connectionStatus: "none" | "pending" | "connected";
  isOwner: boolean;
  isSignedIn: boolean;
  isConnecting: boolean;
  onConnect: () => void;
  onMessage: () => void;
  onCollaborate: () => void;
  onAddToProject: () => void;
  onShare: () => void;
  onJoin: () => void;
}

export function PublicPassportHero({
  profile,
  credits,
  connectionStatus,
  isOwner,
  isSignedIn,
  isConnecting,
  onConnect,
  onMessage,
  onCollaborate,
  onAddToProject,
  onShare,
  onJoin,
}: PublicPassportHeroProps) {
  const passportId = useMemo(
    () => profile.user_id ? `THR-${profile.user_id.replace(/-/g, "").slice(0, 5).toUpperCase()}` : "THR-—",
    [profile.user_id],
  );
  const verifiedCredits = credits.filter((credit) => credit.isVerified || credit.verification_status === "verified");
  const strongestCredits = (verifiedCredits.length ? verifiedCredits : credits).slice(0, 2);
  const skills = Array.isArray(profile.professional_skills)
    ? profile.professional_skills.map((skill: unknown) => {
        if (typeof skill === "string") return skill;
        if (typeof skill === "object" && skill !== null) {
          const value = skill as { skill?: unknown; name?: unknown };
          if (typeof value.skill === "string") return value.skill;
          if (typeof value.name === "string") return value.name;
        }
        return null;
      }).filter((skill): skill is string => Boolean(skill)).slice(0, 6)
    : [];
  const socialLinks = [
    { url: profile.instagram_url, label: "Instagram", icon: Instagram },
    { url: profile.linkedin_url, label: "LinkedIn", icon: Linkedin },
    { url: profile.twitter_url, label: "Twitter", icon: Twitter },
    { url: profile.youtube_url, label: "YouTube", icon: Youtube },
    { url: profile.spotify_url, label: "Spotify", icon: Music },
    { url: profile.website, label: "Website", icon: Globe },
  ].filter((link) => Boolean(link.url));
  const connected = connectionStatus === "connected";

  return (
    <HoloCard>
      <article className="relative overflow-hidden rounded-2xl border border-border bg-card">
        <div className={cn("relative aspect-[3/1] sm:aspect-[4/1] overflow-hidden", !profile.cover_image_url && "bg-muted/60")}>
          {profile.cover_image_url && <img src={profile.cover_image_url} alt="" className="h-full w-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/10 to-transparent" />
          <div className="absolute left-2 top-2 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
            Creative Passport
          </div>
          <Button onClick={onShare} size="icon" variant="secondary" className="absolute right-2 top-2 h-9 w-9 rounded-full" aria-label="Share Passport">
            <Share2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="relative -mt-8 space-y-4 px-5 pb-5">
          <FramedAvatar
            src={profile.avatar_url || "/avatar-silhouette.svg"}
            fallback={profile.full_name?.split(" ").map((name: string) => name[0]).join("") || "?"}
            alt={profile.full_name || undefined}
            frame={profile.profile_frame}
            className="h-20 w-20 rounded-full border-2 border-card bg-card shadow-lg"
          />

          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <h1 className="break-words text-xl font-black leading-tight tracking-normal">{profile.full_name}</h1>
              {profile.verification_status === "verified" && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary" title="Verified creator">
                  <CheckCircle2 className="h-2.5 w-2.5 text-primary-foreground" />
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
              <Fingerprint className="h-3 w-3 text-[hsl(var(--signal-teal))]" />
              <span>{passportId}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {profile.username && <span className="font-mono text-foreground/80">@{profile.username}</span>}
              <span>{profile.job_title || profile.role || "Creator"}</span>
              {profile.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{profile.location}</span>}
              <AvailabilityIndicator status={profile.availability_status || profile.availability} note={profile.availability_note} isOwnProfile={false} />
            </div>
            {Array.isArray(profile.sub_roles) && profile.sub_roles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {profile.sub_roles.slice(0, 4).map((role: string) => <Badge key={role} variant="outline" className="h-5 px-1.5 text-[10px]">{role}</Badge>)}
              </div>
            )}
          </div>

          {profile.bio && <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{profile.bio}</p>}

          <TrustSignals emailVerified={profile.email_verified} phoneVerified={profile.phone_verified} idVerified={profile.id_verified} paymentVerified={profile.payment_verified} isOwnProfile={false} compact />

          {strongestCredits.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Strongest credits</p>
              <div className="grid grid-cols-2 gap-2">
                {strongestCredits.map((credit, index) => (
                  <div key={`${credit.project_name || credit.title}-${index}`} className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
                    <p className="truncate text-xs font-semibold">{credit.project_name || credit.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{credit.role}{(credit.isVerified || credit.verification_status === "verified") && <span className="text-[hsl(var(--signal-teal))]"> · Verified</span>}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 text-[hsl(var(--signal-teal))]" />
            <span>{credits.length} stamp{credits.length === 1 ? "" : "s"} · {verifiedCredits.length} verified</span>
          </div>

          {skills.length > 0 && <div className="flex flex-wrap gap-1">{skills.map((skill: string) => <Badge key={skill} variant="outline" className="h-5 px-1.5 text-[10px]">{skill}</Badge>)}</div>}

          {socialLinks.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
              {socialLinks.map(({ url, label, icon: Icon }) => (
                <Button key={label} asChild variant="outline" size="icon" className="h-9 w-9 rounded-full">
                  <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${label}`}><Icon className="h-4 w-4" /></a>
                </Button>
              ))}
              {profile.calendly_url && <Button asChild variant="outline" className="h-9 gap-1.5"><a href={profile.calendly_url} target="_blank" rel="noopener noreferrer"><Calendar className="h-4 w-4" />Book</a></Button>}
            </div>
          )}

          {!isOwner && (
            <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-4">
              {!isSignedIn ? (
                <Button onClick={onJoin} className="col-span-2 gap-2"><UserPlus className="h-4 w-4" />Connect with {profile.full_name?.split(" ")[0] || "this creator"}</Button>
              ) : connected ? (
                <>
                  <Button onClick={onMessage} className="gap-2"><MessageCircle className="h-4 w-4" />Message</Button>
                  <Button onClick={onCollaborate} variant="outline" className="gap-2"><Handshake className="h-4 w-4" />Collaborate</Button>
                  <Button onClick={onAddToProject} variant="outline" className="col-span-2 gap-2"><FolderPlus className="h-4 w-4" />Add to a project</Button>
                </>
              ) : (
                <Button onClick={onConnect} disabled={connectionStatus === "pending" || isConnecting} className="col-span-2 gap-2">
                  <UserPlus className="h-4 w-4" />{connectionStatus === "pending" ? "Request pending" : isConnecting ? "Sending…" : "Connect"}
                </Button>
              )}
            </div>
          )}

          {isOwner && <Button onClick={onShare} variant="outline" className="w-full gap-2"><Share2 className="h-4 w-4" />Share Passport</Button>}
          {(profile.website || profile.calendly_url) && <p className="sr-only"><ExternalLink aria-hidden="true" />Public contact links</p>}
        </div>
      </article>
    </HoloCard>
  );
}