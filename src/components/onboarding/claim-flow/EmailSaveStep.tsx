import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, ArrowLeft, CheckCircle2, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lookupAuthProviders, providerLabel } from "@/lib/authProviderHints";
import { toast } from "sonner";
import type { ClaimedCredit, DraftProfile } from "./types";

interface Props {
  profile: DraftProfile;
  credits: ClaimedCredit[];
  onBack: () => void;
  redirectAfter?: string;
  faceMatchScore?: number | null;
  faceVerificationToken?: string | null;
}

/** Step 4: capture email, send magic link, persist everything. */
export const EmailSaveStep = ({ profile, credits, onBack, redirectAfter = "/profile?claimed=true", faceVerificationToken }: Props) => {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [existing, setExisting] = useState<{ providers: string[] } | null>(null);

  // Debounced lookup: when the user enters an email already on file,
  // prompt them to sign in instead of creating a duplicate.
  useEffect(() => {
    const e = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setExisting(null);
      return;
    }
    const t = setTimeout(async () => {
      const res = await lookupAuthProviders(e);
      if (res?.exists) setExisting({ providers: res.providers || [] });
      else setExisting(null);
    }, 450);
    return () => clearTimeout(t);
  }, [email]);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      // Stash the claim so AuthContext can attach it after sign-in
      try {
        sessionStorage.setItem(
          "thrivein_pending_claim_full",
          JSON.stringify({ profile, credits, redirectAfter }),
        );
      } catch {}
      // Supabase's own OAuth, not Lovable's broker -- see Auth.tsx's
      // handleOAuthSignIn for why. supabase-js assigns window.location.href
      // itself on success, so there's nothing to do after the call besides
      // handling an error returned before that redirect starts.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}${redirectAfter}` },
      });
      if (error) {
        toast.error(error.message || "Google sign-in failed");
        setGoogleLoading(false);
      }
    } catch (e: any) {
      toast.error(e?.message || "Google sign-in failed");
      setGoogleLoading(false);
    }
  };

  const submit = async () => {
    const e = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      toast.error("Enter a valid email");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("claim-and-create-profile", {
        body: {
          email: e,
          profile,
          credits,
          face_verification_token: faceVerificationToken ?? null,
          redirect_to: `${window.location.origin}${redirectAfter}`,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSent(true);
    } catch (err: any) {
      console.error("[ClaimFlow] save failed", err);
      toast.error(err?.message || "Couldn't save your profile. Try again.");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="py-8 text-center space-y-4">
        <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckCircle2 className="h-7 w-7 text-primary" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold">Check your email</h2>
          <p className="text-sm text-muted-foreground px-4">
            We sent a magic link to <span className="font-semibold">{email}</span>. Tap it to land on your new profile.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Don't see it? Check spam, or wait 60 seconds before resending.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <h2 className="text-xl font-bold">Save your profile</h2>
        <p className="text-sm text-muted-foreground">
          Continue with Google for one tap, or use a magic link.
        </p>
      </div>

      <Button
        type="button"
        onClick={handleGoogle}
        disabled={googleLoading || sending}
        variant="outline"
        size="lg"
        className="w-full h-12 gap-2"
      >
        {googleLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        )}
        Continue with Google
      </Button>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">
          or email
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="claim-email">Email</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="claim-email"
            type="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            onKeyDown={(ev) => ev.key === "Enter" && submit()}
            placeholder="you@studio.com"
            className="pl-9 h-12 text-base"
            disabled={sending || googleLoading}
          />
        </div>
      </div>

      {existing && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <LogIn className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="text-xs text-foreground/90 leading-relaxed">
              <span className="font-semibold">You already have a Kretopia profile.</span>{" "}
              {existing.providers.length > 0 && (
                <span className="text-muted-foreground">
                  Sign in with {existing.providers.map(providerLabel).join(" or ")}.
                </span>
              )}
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            className="w-full h-9"
            onClick={() => {
              try {
                sessionStorage.setItem(
                  "thrivein_pending_claim_full",
                  JSON.stringify({ profile, credits, redirectAfter }),
                );
              } catch {}
              window.location.href = `/auth?tab=signin&email=${encodeURIComponent(email.trim())}`;
            }}
          >
            Sign in instead
          </Button>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={onBack} size="lg" disabled={sending || googleLoading}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Button onClick={submit} disabled={sending || googleLoading || !email.trim()} className="flex-1" size="lg">
          {sending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>Send magic link</>
          )}
        </Button>
      </div>

      <p className="text-[11px] text-center text-muted-foreground">
        By continuing you agree to our Terms & Privacy Policy.
      </p>
    </div>
  );
};
