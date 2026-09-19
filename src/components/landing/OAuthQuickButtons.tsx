import { useState } from "react";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface OAuthQuickButtonsProps {
  /** Optional external handler — if provided, internal sign-in logic is skipped */
  onGoogle?: () => void;
  onApple?: () => void;
  googleLoading?: boolean;
  appleLoading?: boolean;
  /** Optional divider/header label */
  label?: string;
  /** Hide divider entirely */
  hideDivider?: boolean;
  /** Optional analytics suffix when using built-in handler */
  analyticsSuffix?: string;
}

/**
 * One-tap OAuth buttons.
 * - Standalone mode (no props): handles sign-in internally for landing/hero use.
 * - Controlled mode (onGoogle/onApple): defers to parent (e.g. Auth page).
 */
export const OAuthQuickButtons = ({
  onGoogle,
  onApple,
  googleLoading: extGoogleLoading,
  appleLoading: extAppleLoading,
  label = "Or join in one tap",
  hideDivider = false,
  analyticsSuffix = "hero",
}: OAuthQuickButtonsProps = {}) => {
  const [internalLoading, setInternalLoading] = useState<"google" | "apple" | null>(null);
  const controlled = !!(onGoogle || onApple);

  const handle = async (provider: "google" | "apple") => {
    if (controlled) {
      if (provider === "google") onGoogle?.();
      else onApple?.();
      return;
    }
    setInternalLoading(provider);
    try {
      const { analytics } = await import("@/lib/analytics");
      analytics.featureUsed(`${provider}_signin_attempt_${analyticsSuffix}`);

      // window.location.origin, not a hardcoded domain -- see Auth.tsx's
      // own handleOAuthSignIn for why (redirect_uri must match whatever
      // host actually served the page or the OAuth broker 400s it).
      const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
      const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: siteUrl });

      if ("redirected" in result && result.redirected) return;

      if (result.error) {
        const msg = result.error.message || "";
        if (msg.includes("cancelled")) { setInternalLoading(null); return; }
        toast({
          title: `${provider === "google" ? "Google" : "Apple"} sign-in unavailable`,
          description: msg.includes("blocked")
            ? "Please allow pop-ups or open the app in a new tab."
            : "Try again or use email sign-up.",
          variant: "destructive",
        });
        setInternalLoading(null);
      }
    } catch (err) {
      console.error(`[Hero OAuth ${provider}]`, err);
      setInternalLoading(null);
    }
  };

  const googleLoading = controlled ? !!extGoogleLoading : internalLoading === "google";
  const appleLoading = controlled ? !!extAppleLoading : internalLoading === "apple";
  const anyLoading = googleLoading || appleLoading;

  return (
    <div className="max-w-xl mx-auto mt-3">
      {!hideDivider && (
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">
            {label}
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => handle("google")}
          disabled={anyLoading}
          className="btn-glass btn-glass-neutral inline-flex items-center justify-center gap-2 h-12 rounded-xl text-sm font-semibold disabled:opacity-50"
          aria-label="Continue with Google"
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
          Google
        </button>

        <button
          type="button"
          onClick={() => handle("apple")}
          disabled={anyLoading}
          className="btn-glass btn-glass-neutral inline-flex items-center justify-center gap-2 h-12 rounded-xl text-sm font-semibold disabled:opacity-50"
          aria-label="Continue with Apple"
        >
          {appleLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
          )}
          Apple
        </button>
      </div>

      {!controlled && (
        <p className="text-center text-[11px] text-muted-foreground/70 mt-3">
          Free to join · We'll auto-find your work after sign-in
        </p>
      )}
    </div>
  );
};
