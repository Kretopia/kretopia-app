import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Lock, Sparkles, User, Briefcase } from "lucide-react";
import { WaitlistForm } from "@/components/landing/WaitlistForm";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

// Refactored sub-components
import { AuthBrandingPanel } from "@/components/auth/AuthBrandingPanel";
import { SignInForm } from "@/components/auth/SignInForm";
import { SignUpWizard } from "@/components/auth/SignUpWizard";
import { UniversalClaimFlow } from "@/components/onboarding/claim-flow/UniversalClaimFlow";
import { PasswordResetForm } from "@/components/auth/PasswordResetForm";
import { ForgotPasswordDialog } from "@/components/auth/ForgotPasswordDialog";
import { BrandLogo } from "@/components/BrandLogo";
import { OAuthQuickButtons } from "@/components/landing/OAuthQuickButtons";
import { FunnelStepper } from "@/components/onboarding/FunnelStepper";
import { computePostAuthRedirect } from "@/lib/eventAuthRedirect";
import {
  resolveAuthEntrySource, categorizeAuthError,
  trackSignupAttempt, trackSignupSuccess, trackSignupError,
  trackSigninAttempt, trackSigninSuccess, trackSigninError,
} from "@/lib/landingMetrics";

const Auth = () => {
  const reducedMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<string>("signin");
  const [signupMode, setSignupMode] = useState<"claim" | "classic">("claim");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [accountType, setAccountType] = useState<"individual" | "company">("individual");
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showWaitlistForm, setShowWaitlistForm] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);

  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const claimParam = searchParams.get("claim");
  const claimProfileId = claimParam && claimParam !== "1" ? claimParam : null;
  const eventId = searchParams.get("event");
  // If user arrived via event RSVP gate, stash the return target so post-onboarding
  // and post-email-confirmation flows route them back to the event page.
  useEffect(() => {
    if (eventId && typeof window !== "undefined") {
      sessionStorage.setItem("thrivein_post_auth_redirect", `/event/${eventId}`);
    }
  }, [eventId]);
  // Honor a sessionStorage post-auth redirect set by soft-gates (AuthPrompt, etc.)
  // Falls back to ?redirect= query param, then /circle.
  const stashedRedirect = typeof window !== "undefined"
    ? sessionStorage.getItem("thrivein_post_auth_redirect")
    : null;
  const redirectTo = computePostAuthRedirect({
    eventId,
    claimProfileId,
    nextParam: searchParams.get("next"),
    redirectParam: searchParams.get("redirect"),
    stashedRedirect,
  });
  const isPasswordReset = searchParams.get("reset") === "true";
  const connectUserId = searchParams.get("connect");
  const authEntrySource = resolveAuthEntrySource(searchParams);

  // Set initial tab from URL.
  //
  // With no explicit ?tab, first-time visitors now land on Sign Up rather
  // than Sign In: sign-in attempts massively outnumbered new accounts, so
  // defaulting to Sign In was asking brand-new visitors to complete the one
  // form they cannot complete. Anyone who has signed in on this device
  // before still lands on Sign In.
  useEffect(() => {
    const tab = searchParams.get("tab");
    const isReturning = (() => {
      try {
        // Set by setLastSignInMethod() after any successful sign-in.
        return !!localStorage.getItem("thrivein_last_signin_method");
      } catch {
        return false;
      }
    })();

    if (tab === "signin") setActiveTab("signin");
    else if (tab === "signup" || searchParams.get("claim") || searchParams.get("invite") || searchParams.get("inviteCode")) {
      setActiveTab("signup");
    } else {
      setActiveTab(isReturning ? "signin" : "signup");
    }
  }, [searchParams]);

  const authLoadTime = useState(() => Date.now())[0];
  const hasTrackedView = useState(false);

  // Redirect if already authenticated & track page view
  useEffect(() => {
    if (!hasTrackedView[0]) {
      hasTrackedView[1](true);
      const trackPage = async () => {
        const { analytics, trackEvent, EventCategory } = await import("@/lib/analytics");
        analytics.pageView("auth");
        trackEvent({
          eventName: 'auth_page_loaded',
          eventCategory: EventCategory.AUTH,
          properties: {
            referrer: document.referrer,
            has_invite_code: !!(searchParams.get("invite") || searchParams.get("inviteCode") || sessionStorage.getItem("invite_code")),
            has_claim: !!searchParams.get("claim"),
            has_connect: !!searchParams.get("connect"),
            entry_source: document.referrer.includes('kretopia') ? 'internal' : document.referrer ? 'external' : 'direct',
          },
        });
      };
      trackPage();
    }

    if (user) {
      if (connectUserId) {
        handleAutoConnect(connectUserId);
      } else {
        const checkOnboarding = async () => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('onboarding_completed, account_type')
            .eq('user_id', user.id)
            .single();

          if (!profile || !profile.onboarding_completed) {
            const { analytics } = await import("@/lib/analytics");
            analytics.onboardingStart();
            navigate(profile?.account_type === 'company' ? "/company-onboarding" : "/onboarding");
          } else {
            // Stage pending claim credits as candidates for returning users —
            // NEVER insert straight into `credits`. These are search-found,
            // user-supplied-context guesses, not confirmed work history; they
            // go through the same discovered_credits review screen
            // (DiscoveriesInbox on /profile) as AI-discovered credits, so the
            // user explicitly confirms/edits/removes each one before it
            // becomes part of their Passport.
            const pendingClaimRaw = sessionStorage.getItem('pending_claim_credits');
            if (pendingClaimRaw) {
              try {
                const claimData = JSON.parse(pendingClaimRaw);
                const candidatesToInsert = (claimData.credits || [])
                  .filter((c: any) => c.project && c.role)
                  .map((c: any) => ({
                    user_id: user.id,
                    project_name: c.project,
                    role: c.role,
                    year: c.year || null,
                    platform: c.platform || null,
                    source: 'search_claim',
                    status: 'pending',
                  }));
                if (candidatesToInsert.length > 0) {
                  await supabase.from('discovered_credits').insert(candidatesToInsert);
                }
                sessionStorage.setItem('show_claim_continue', JSON.stringify({
                  name: claimData.name || claimData.query,
                  count: candidatesToInsert.length,
                }));
                sessionStorage.removeItem('pending_claim_credits');
              } catch (e) { console.error('[Auth] Stage claim credits error:', e); }
            }
            sessionStorage.removeItem("thrivein_post_auth_redirect");
            navigate(redirectTo);
          }
        };
        checkOnboarding();
      }
    }

    // Pre-fill invite code
    const inviteFromUrl = searchParams.get("invite") || searchParams.get("inviteCode");
    const inviteFromSession = sessionStorage.getItem("invite_code");
    if (inviteFromUrl) {
      setInviteCode(inviteFromUrl.toUpperCase());
    } else if (inviteFromSession) {
      setInviteCode(inviteFromSession.toUpperCase());
      sessionStorage.removeItem("invite_code");
    }
  }, [user, navigate, redirectTo, searchParams, connectUserId]);

  const handleAutoConnect = async (targetUserId: string) => {
    if (!user) return;
    try {
      const { data: existingConnection } = await supabase
        .from('connections')
        .select('*')
        .or(`and(user_id.eq.${user.id},connected_user_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},connected_user_id.eq.${user.id})`)
        .maybeSingle();

      if (existingConnection) {
        toast({ title: "Already Connected", description: "You're already connected with this user" });
        navigate('/circle?tab=network');
        return;
      }

      const [{ data: targetProfile }, { data: currentProfile }] = await Promise.all([
        supabase.from('profiles').select('full_name, avatar_url, role').eq('user_id', targetUserId).single(),
        supabase.from('profiles').select('full_name, avatar_url, role').eq('user_id', user.id).single()
      ]);

      // Both of these were raw table inserts that a prior session's RLS
      // hardening (20260904090000 for connections; 20260912120000 for
      // matches) now correctly rejects -- neither insert carries the
      // swipe evidence those policies require. Routed through the same
      // RPCs Onboarding.tsx's equivalent QR-connect flow already uses.
      const { error: connectionError } = await supabase.rpc('create_bidirectional_connection', {
        user1_uuid: user.id, user2_uuid: targetUserId, connection_status: 'accepted',
      });
      if (connectionError) throw connectionError;

      await supabase.rpc('create_direct_match' as any, { _other_user_id: targetUserId });

      await supabase.from('notifications').insert([
        { user_id: user.id, type: 'connection', title: `Connected with ${targetProfile?.full_name || 'a creator'}!`, message: `You're now connected via QR code. Start collaborating!`, link: `/profile/${targetUserId}?from=match`, action_url: `/messages?user=${targetUserId}`, action_text: 'Send Message', image_url: targetProfile?.avatar_url },
        { user_id: targetUserId, type: 'connection', title: `${currentProfile?.full_name || 'Someone'} connected with you!`, message: `New connection via QR code. Say hello!`, link: `/profile/${user.id}?from=match`, action_url: `/messages?user=${user.id}`, action_text: 'Send Message', image_url: currentProfile?.avatar_url }
      ]);

      toast({ title: "Connected!", description: `You and ${targetProfile?.full_name || 'this creator'} are now connected!` });
      navigate(`/profile/${targetUserId}?from=match`);
    } catch (error) {
      console.error('Auto-connect error:', error);
      toast({ title: "Connection Failed", description: "Unable to create connection", variant: "destructive" });
      navigate(redirectTo);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { trackEvent, EventCategory } = await import("@/lib/analytics");
    trackEvent({ eventName: 'signin_attempt', eventCategory: EventCategory.AUTH, properties: { time_on_page_ms: Date.now() - authLoadTime } });
    trackSigninAttempt(authEntrySource, "email");

    try {
      try {
        localStorage.removeItem('sb-kwmcocsitwssrtzkdojh-auth-token');
        sessionStorage.clear();
        await supabase.auth.signOut({ scope: 'local' });
      } catch (cleanupErr) {
        console.warn('[Auth] Session cleanup warning:', cleanupErr);
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        const { analytics: errAnalytics } = await import("@/lib/analytics");
        const msg = error.message || "";
        const errorType = msg.includes("Invalid login") ? "invalid_credentials"
          : msg.includes("Email not confirmed") ? "email_not_confirmed"
          : msg.includes("Failed to fetch") ? "network_error"
          : msg.toLowerCase().includes("rate") ? "rate_limited"
          : "other";
        // Always include the raw message so we can debug the 'other' bucket
        errAnalytics.errorOccurred('signin_failed', errorType, 'auth');
        trackSigninError(authEntrySource, "email", categorizeAuthError(error));

        if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
          toast({ title: "Connection Error", description: "Please check your internet connection and try again.", variant: "destructive" });
        } else if (msg.includes("Email not confirmed")) {
          toast({
            title: "Email Not Verified",
            description: "Check your inbox for the verification link, or use 'Email me a sign-in link' to skip verification.",
            variant: "destructive",
          });
        } else if (msg.includes("Invalid login credentials")) {
          toast({
            title: "Wrong email or password",
            description: "Try 'Email me a sign-in link' above — no password needed.",
            variant: "destructive",
          });
        } else if (msg.toLowerCase().includes("rate")) {
          toast({ title: "Too many attempts", description: "Please wait a moment and try again.", variant: "destructive" });
        } else {
          toast({ title: "Sign-in failed", description: msg || "Something went wrong. Try the magic-link option above.", variant: "destructive" });
        }
      } else {
        const { analytics } = await import("@/lib/analytics");
        analytics.signIn('email');
        trackSigninSuccess(authEntrySource, "email");
        const { setLastSignInMethod } = await import("@/lib/authProviderHints");
        setLastSignInMethod("email");

        const { data: { user: signedInUser } } = await supabase.auth.getUser();
        if (signedInUser) {
          const { data: adminData } = await supabase
            .from("user_roles").select("role").eq("user_id", signedInUser.id).eq("role", "admin").maybeSingle();

          toast({ title: "Welcome back!", description: "You've successfully signed in" });
          navigate(!!adminData ? "/admin" : redirectTo);
        } else {
          navigate(redirectTo);
        }
      }
    } catch (err: any) {
      console.error('[Auth] Sign in error:', err);
      toast({ title: "Connection Error", description: "Unable to connect. Please check your internet and try again.", variant: "destructive" });
    }
    setLoading(false);
  };

  const handleOAuthSignIn = async (provider: "google") => {
    setGoogleLoading(true);

    const { analytics } = await import("@/lib/analytics");
    analytics.featureUsed(`${provider}_signin_attempt`);
    const isSignupIntent = activeTab === "signup";
    if (isSignupIntent) trackSignupAttempt(authEntrySource, provider);
    else trackSigninAttempt(authEntrySource, provider);

    try {
      // Supabase's own OAuth, not Lovable's broker -- Lovable's provider
      // config lives behind "Lovable Cloud", a separate paid backend layer
      // this project doesn't use (it runs on its own external Supabase
      // project already). Calling Supabase directly needs no Lovable
      // credits and no second backend; Google just needs to be enabled
      // with real client credentials in Supabase's own (free)
      // Authentication > Providers page.
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      });

      // No popup, no iframe, no "cancelled" state to detect here: unlike
      // Lovable's broker, supabase-js just assigns window.location.href
      // itself on success, so the only thing left to handle is an error
      // returned before that navigation ever starts (e.g. the provider
      // isn't enabled yet). The old "redirected: true" early return and
      // its sibling success branch (toast + tracking) never actually ran
      // for a real visitor either -- that only fired inside Lovable's own
      // preview iframe, not on a real window.location redirect -- so
      // nothing observable changes for real users here.
      if (error) {
        analytics.errorOccurred(`${provider}_signin`, error.message, "auth");
        if (isSignupIntent) trackSignupError(authEntrySource, provider, categorizeAuthError(error));
        else trackSigninError(authEntrySource, provider, categorizeAuthError(error));
        toast({ title: "Google Sign-In Failed", description: error.message, variant: "destructive" });
        setGoogleLoading(false);
      }
    } catch (err: any) {
      console.error(`${provider} sign-in error:`, err);
      toast({ title: "Error", description: "Failed to sign in with Google. Please try again.", variant: "destructive" });
      setGoogleLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { trackEvent, EventCategory } = await import("@/lib/analytics");
    trackEvent({ eventName: 'signup_attempt', eventCategory: EventCategory.AUTH, properties: { time_on_page_ms: Date.now() - authLoadTime, account_type: accountType, has_invite_code: !!inviteCode } });
    trackSignupAttempt(authEntrySource, "email");

    const { data: signUpData, error } = await supabase.auth.signUp({
      email, password,
      options: {
        // Land verified users directly in onboarding so the profile setup picks up where they left off.
        // window.location.origin handles preview, custom-domain, and prod automatically.
        emailRedirectTo: `${window.location.origin}/onboarding`,
        data: { account_type: accountType, invite_code: inviteCode },
      },
    });

    if (error) {
      const { analytics: errAnalytics } = await import("@/lib/analytics");
      const msg = error.message || "";
      const errorType = msg.includes("already registered") ? "already_registered"
        : msg.toLowerCase().includes("password") ? "weak_password"
        : msg.toLowerCase().includes("email") ? "invalid_email"
        : msg.toLowerCase().includes("rate") ? "rate_limited"
        : msg.includes("Failed to fetch") ? "network_error"
        : "other";
      errAnalytics.errorOccurred('signup_failed', errorType, 'auth');
      trackSignupError(authEntrySource, "email", categorizeAuthError(error));

      if (msg.includes("already registered")) {
        toast({ title: "Account Exists", description: "This email is already registered. Switching to sign in.", variant: "destructive" });
        setActiveTab("signin");
      } else if (msg.toLowerCase().includes("password")) {
        toast({ title: "Password too weak", description: "Use at least 8 characters with a mix of letters and numbers.", variant: "destructive" });
      } else if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        toast({ title: "Connection Error", description: "Please check your internet and try again.", variant: "destructive" });
      } else {
        toast({ title: "Sign-up failed", description: msg || "Something went wrong. Try a different email or sign in instead.", variant: "destructive" });
      }
    } else {
      // Detect Supabase "fake user" when email already exists (identities is empty)
      if (signUpData?.user && (!signUpData.user.identities || signUpData.user.identities.length === 0)) {
        trackSignupError(authEntrySource, "email", "account_exists");
        toast({ title: "Account Exists", description: "This email is already registered. Please sign in instead.", variant: "destructive" });
        setActiveTab("signin");
        setLoading(false);
        return;
      }

      const { analytics } = await import("@/lib/analytics");
      analytics.signUp('email');
      analytics.onboardingStart();
      trackSignupSuccess(authEntrySource, "email");

      if (signUpData?.user && inviteCode) {
        try {
          await supabase.rpc('use_invite_code', { code: inviteCode.trim(), user_email: email, new_user_id: signUpData.user.id });
        } catch (inviteErr) { console.error('Error using invite code:', inviteErr); }
      }

      if (connectUserId) localStorage.setItem('pendingConnect', connectUserId);

      // If email confirmation is required, Supabase returns a user with no session.
      // Don't navigate to /onboarding (it would bounce back to /auth) — show a "check your email" screen instead.
      if (!signUpData?.session) {
        setPendingVerificationEmail(email);
        toast({ title: "Check your email", description: "We sent you a verification link to finish signing up." });
        setLoading(false);
        return;
      }

      toast({ title: "Welcome to Kretopia!", description: "Let's set up your profile." });
      const postSignupTarget = eventId
        ? `/event/${eventId}`
        : accountType === "company" ? "/company-onboarding" : "/onboarding";
      navigate(postSignupTarget);
    }
    setLoading(false);
  };

  const handlePasswordReset = async (newPassword: string) => {
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password Reset Successful", description: "Your password has been updated. Start matching!" });
      setTimeout(() => navigate("/circle"), 1500);
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "hsl(var(--background))" }}>
      <AuthBrandingPanel />

      {/* Right column stays fixed in the viewport — only the form scrolls internally,
          so loading a credit/profile from the landing search never shifts the page.
          Top-aligned (no `my-auto`) so the heading sits at exactly the column's own
          top padding — the same `pt-8 sm:pt-12` the left branding panel's logo uses,
          so the two sides' top margins genuinely match instead of both being
          independently vertically centered (which only coincidentally lines up,
          and only when both columns' content happens to be the same height). */}
      <div className="relative flex w-full lg:w-1/2 items-start justify-center px-4 sm:px-6 py-8 sm:py-12 overflow-hidden lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
        {/* Ambient AI-glow behind the form — same language as the landing hero */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 ai-ambient-breathe"
          style={{ background: "radial-gradient(55% 45% at 50% 20%, rgba(255,45,161,0.08), transparent 65%)" }}
        />
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.2, 0.65, 0.3, 0.95] }}
          className="relative w-full max-w-md"
        >
          <div className="mb-6 sm:mb-8 text-center">
            <div className="lg:hidden mb-4">
              <BrandLogo size="lg" showBeta linkToHome />
            </div>
            <h1
              className="landing-h2 landing-glow whitespace-nowrap"
              style={{ color: "hsl(var(--foreground))", fontSize: "clamp(1.375rem, 5.5vw, 1.875rem)" }}
            >
              {isPasswordReset ? "Reset Your Password" : (
                <>Welcome to <span className="italic pink-glow-breathe" style={{ color: "#FF2DA1" }}>Kretopia</span></>
              )}
            </h1>
            <p className="landing-sub mt-3" style={{ color: "hsl(var(--muted-foreground))" }}>
              {isPasswordReset ? "Enter your new password below" : "Where creators find work — and get paid"}
            </p>
          </div>

          {/* Editorial form shell — same language as the Hire Talent brief form */}
          <div className="rounded-2xl border border-border bg-foreground/[0.02] overflow-hidden">
            {!isPasswordReset && activeTab === "signup" && (
              <div className="p-4 sm:p-5 border-b border-border bg-gradient-to-r from-[rgba(255,45,161,0.08)] via-transparent to-transparent">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(255,45,161,0.12)]">
                    <Sparkles className="h-4 w-4" style={{ color: "#FF2DA1" }} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-foreground font-semibold text-sm">Start with Kreto</p>
                    <p className="text-foreground/50 text-xs">Search your name — we'll pull the credits and build your Passport.</p>
                  </div>
                </div>
                <FunnelStepper current="signup" />
              </div>
            )}

            <div className="p-4 sm:p-6 min-h-[420px]">


          {isPasswordReset ? (
            <PasswordResetForm loading={loading} onSubmit={handlePasswordReset} />
          ) : pendingVerificationEmail ? (
            <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">Confirm your email to continue</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  We sent a verification link to <span className="font-medium text-foreground">{pendingVerificationEmail}</span>.
                  Click it to finish signing up and start onboarding.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await supabase.auth.resend({ type: "signup", email: pendingVerificationEmail });
                    toast({ title: "Verification email resent" });
                  } catch (err: any) {
                    toast({ title: "Could not resend", description: err?.message || "Try again in a moment.", variant: "destructive" });
                  }
                }}
                className="text-sm text-foreground font-semibold hover:text-[#FF2DA1] hover:underline transition-colors"
              >
                Resend verification email
              </button>
              <div>
                <button
                  type="button"
                  onClick={() => { setPendingVerificationEmail(null); setActiveTab("signin"); }}
                  className="text-xs text-foreground/60 hover:text-[#FF2DA1] underline-offset-4 hover:underline transition-colors"
                >
                  Use a different email
                </button>
              </div>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={async (tab) => {
              setActiveTab(tab);
              const { trackEvent, EventCategory } = await import("@/lib/analytics");
              trackEvent({ eventName: 'auth_tab_switch', eventCategory: EventCategory.AUTH, properties: { tab, time_on_page_ms: Date.now() - authLoadTime } });
            }} className="w-full">
              <TabsList className="mb-6 grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <SignInForm
                  email={email} setEmail={setEmail}
                  password={password} setPassword={setPassword}
                  loading={loading} onSubmit={handleSignIn}
                  onForgotPassword={() => setShowForgotPassword(true)}
                  onGoogleSignIn={() => handleOAuthSignIn("google")}
                  googleLoading={googleLoading}
                />
              </TabsContent>

              <TabsContent value="signup">
                {signupMode === "claim" ? (
                  <>
                    {/* Creator vs Brand toggle -- same modern icon-card
                        treatment as SignUpWizard's own toggle (below, once
                        signupMode flips to "classic"), not the old emoji
                        pill: switching between them mid-flow read as two
                        different UIs for the same choice. */}
                    <div className="mb-4 grid grid-cols-2 gap-2 p-1 rounded-xl bg-muted/50 border">
                      <button
                        type="button"
                        onClick={() => setAccountType("individual")}
                        className={`flex flex-col items-center gap-1 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                          accountType === "individual"
                            ? "bg-background shadow-sm text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        aria-pressed={accountType === "individual"}
                      >
                        <User className="h-4 w-4" />
                        I'm a Creator
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAccountType("company");
                          setSignupMode("classic");
                        }}
                        className={`flex flex-col items-center gap-1 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                          accountType === "company"
                            ? "bg-background shadow-sm text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        aria-pressed={accountType === "company"}
                      >
                        <Briefcase className="h-4 w-4" />
                        I'm a Brand
                      </button>
                    </div>

                    {/* Google leads now, not the search -- sign-in attempts
                        massively outnumber people who complete a multi-step
                        name search, so the fastest path into the app goes
                        first. Search stays one scroll away for anyone who
                        wants Kreto to pull in their existing credits instead
                        of starting blank. */}
                    <p className="text-center text-sm font-semibold text-foreground mb-0.5">
                      Get in fast with Google
                    </p>
                    <p className="text-center text-xs text-muted-foreground mb-4">
                      Create your Kretopia Passport in seconds.
                    </p>
                    <OAuthQuickButtons
                      onGoogle={() => handleOAuthSignIn("google")}
                      googleLoading={googleLoading}
                      label=""
                    />
                    <div className="my-5 flex items-center gap-2">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">
                        Or search for yourself
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    <UniversalClaimFlow
                      source={eventId ? "event" : "auth"}
                      contextId={eventId || undefined}
                      redirectAfter={eventId ? `/event/${eventId}` : undefined}
                      initialQuery={searchParams.get("q") || undefined}
                    />
                    <div className="mt-4 text-center">
                      <button
                        type="button"
                        onClick={() => setSignupMode("classic")}
                        className="text-xs text-foreground/60 hover:text-[#FF2DA1] underline-offset-4 hover:underline transition-colors"
                      >
                        Use email & password instead
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <SignUpWizard
                      email={email} setEmail={setEmail}
                      password={password} setPassword={setPassword}
                      confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
                      accountType={accountType} setAccountType={setAccountType}
                      loading={loading} onSubmit={handleSignUp}
                      onGoogleSignIn={() => handleOAuthSignIn("google")}
                      googleLoading={googleLoading}
                    />
                    <div className="mt-4 text-center">
                      <button
                        type="button"
                        onClick={() => setSignupMode("claim")}
                        className="text-xs text-foreground hover:text-[#FF2DA1] hover:underline font-semibold transition-colors"
                      >
                        ← Back to one-tap claim
                      </button>
                    </div>
                  </>
                )}
              </TabsContent>
            </Tabs>
          )}
            </div>
          </div>



          <ForgotPasswordDialog open={showForgotPassword} onOpenChange={setShowForgotPassword} />

          <Dialog open={showWaitlistForm} onOpenChange={setShowWaitlistForm}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-primary" /> Request Access
                </DialogTitle>
                <DialogDescription>No invite code? Apply to join and we'll verify your profile.</DialogDescription>
              </DialogHeader>
              <WaitlistForm />
            </DialogContent>
          </Dialog>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
