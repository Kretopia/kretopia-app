import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2, Eye, EyeOff, Mail, Sparkles, Chrome, CheckCircle2, Info } from "lucide-react";
import { validateEmail, validatePassword } from "@/lib/validation";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  lookupAuthProviders,
  getLastSignInMethod,
  providerLabel,
  type ProviderLookup,
  type SignInMethod,
} from "@/lib/authProviderHints";

interface SignInFormProps {
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onForgotPassword: () => void;
  onGoogleSignIn: () => void;
  googleLoading: boolean;
}

const LastUsedPill = () => (
  <span className="ml-2 inline-flex items-center rounded-full bg-primary/15 text-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
    Last used
  </span>
);

export const SignInForm = ({
  email, setEmail, password, setPassword,
  loading, onSubmit, onForgotPassword,
  onGoogleSignIn, googleLoading,
}: SignInFormProps) => {
  const { toast } = useToast();
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [lookup, setLookup] = useState<ProviderLookup | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lastMethod, setLastMethod] = useState<SignInMethod | null>(null);

  useEffect(() => { setLastMethod(getLastSignInMethod()); }, []);

  // Debounced provider lookup as user types email.
  useEffect(() => {
    const ev = validateEmail(email);
    if (!ev.valid) { setLookup(null); return; }
    setLookupLoading(true);
    const t = setTimeout(async () => {
      const res = await lookupAuthProviders(email);
      setLookup(res);
      setLookupLoading(false);
    }, 450);
    return () => { clearTimeout(t); setLookupLoading(false); };
  }, [email]);

  const hasEmailProvider = !!lookup?.providers.includes("email");
  const hasGoogle = !!lookup?.providers.includes("google");
  const oauthOnlyProvider = lookup?.exists && !hasEmailProvider
    ? (hasGoogle ? "google" : null)
    : null;

  const sendMagicLink = async () => {
    const ev = validateEmail(email);
    if (!ev.valid) {
      setEmailError(ev.error || "Enter your email first");
      return;
    }
    setEmailError("");
    setMagicLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin, shouldCreateUser: false },
      });
      if (error) {
        toast({ title: "Couldn't send link", description: error.message, variant: "destructive" });
      } else {
        setMagicSent(true);
        const { trackEvent, EventCategory } = await import("@/lib/analytics");
        trackEvent({
          eventName: "magic_link_sent",
          eventCategory: EventCategory.AUTH,
          properties: { source: "signin_primary" },
        });
        toast({ title: "Check your inbox", description: `We sent a sign-in link to ${email}.` });
      }
    } finally {
      setMagicLoading(false);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ev = validateEmail(email);
    if (!ev.valid) { setEmailError(ev.error || ""); return; }

    // PRE-FLIGHT: account exists but ONLY via OAuth — don't burn a password attempt.
    if (oauthOnlyProvider) {
      const label = providerLabel(oauthOnlyProvider);
      toast({
        title: `This email signs in with ${label}`,
        description: `Tap "Continue with ${label}" below — no password needed.`,
      });
      return;
    }

    // PRE-FLIGHT: no account at this email at all.
    if (lookup && !lookup.exists) {
      setEmailError("No account for this email. Want to sign up instead?");
      return;
    }

    const pv = validatePassword(password);
    if (!pv.valid) { setPasswordError(pv.error || ""); return; }
    setEmailError("");
    setPasswordError("");
    onSubmit(e);
  };

  const handleOAuthClick = (provider: "google", run: () => void) => {
    // PRE-FLIGHT: email is filled but the account is registered with a different method.
    if (lookup?.exists && !lookup.providers.includes(provider)) {
      const other = lookup.providers[0];
      const otherLabel = other ? providerLabel(other) : "another method";
      toast({
        title: `No ${providerLabel(provider)} account for this email`,
        description: `This email is registered with ${otherLabel}. Sign in that way to keep your work in one place.`,
        variant: "destructive",
      });
      return;
    }
    run();
  };

  return (
    <form onSubmit={handlePasswordSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signin-email">Email</Label>
        <div className="relative">
          <Input
            id="signin-email"
            type="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailError(""); setMagicSent(false); }}
            required
            className={`h-12 text-base ${emailError ? "border-destructive" : ""}`}
            autoComplete="email"
          />
          {lookupLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </div>
        {emailError && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> {emailError}
          </p>
        )}

        {/* PROVIDER HINT — surfaces the right path before they fail */}
        {!emailError && lookup && lookup.exists && (
          <p className="text-xs flex items-start gap-1.5 text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-energy shrink-0" />
            <span>
              We found this account. Sign in with{" "}
              <span className="font-semibold text-foreground">
                {lookup.providers.map(providerLabel).join(" or ") || "Email + Password"}
              </span>.
            </span>
          </p>
        )}
        {!emailError && lookup && !lookup.exists && (
          <p className="text-xs flex items-start gap-1.5 text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 text-amber-500 shrink-0" />
            <span>No account for this email yet — try the <span className="font-semibold text-foreground">Sign Up</span> tab.</span>
          </p>
        )}
      </div>

      {/* Hide password field when we know the account is OAuth-only — avoids confusing failures. */}
      {!oauthOnlyProvider && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="signin-password">
              Password
              {lastMethod === "email" && <LastUsedPill />}
            </Label>
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-xs text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
            >
              Forgot?
            </button>
          </div>
          <div className="relative">
            <Input
              id="signin-password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPasswordError(""); }}
              required={!oauthOnlyProvider}
              className={`h-12 text-base pr-10 ${passwordError ? "border-destructive" : ""}`}
              autoComplete="current-password"
            />
            <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
              {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
            </Button>
          </div>
          {passwordError && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> {passwordError}
            </p>
          )}
        </div>
      )}

      {!oauthOnlyProvider && (
        <Button type="submit" variant="hero" size="lg" className="w-full h-12" disabled={loading}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</> : "Sign in"}
        </Button>
      )}

      {/* OR divider */}
      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {oauthOnlyProvider ? "Continue with" : "Or continue with"}
          </span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        size="lg"
        className={`w-full h-12 gap-2 bg-card hover:bg-muted/40 ${oauthOnlyProvider === "google" ? "ring-2 ring-primary" : ""}`}
        onClick={() => handleOAuthClick("google", onGoogleSignIn)}
        disabled={googleLoading}
      >
        {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Chrome className="h-4 w-4" />}
        Google
        {lastMethod === "google" && <LastUsedPill />}
      </Button>

      {/* Magic link fallback */}
      {!oauthOnlyProvider && (
        magicSent ? (
          <div className="rounded-lg border border-energy/40 bg-energy/5 p-3 text-center">
            <Mail className="h-4 w-4 text-energy mx-auto mb-1" />
            <p className="text-xs font-semibold">Sign-in link sent to {email}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Check your inbox (and spam)</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={sendMagicLink}
            disabled={magicLoading}
            className="w-full text-center text-xs text-muted-foreground hover:text-primary underline-offset-4 hover:underline pt-1 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {magicLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Can't remember your password? Email me a sign-in link
          </button>
        )
      )}
    </form>
  );
};
