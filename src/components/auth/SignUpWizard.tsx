import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, Loader2, ArrowRight, ArrowLeft, User, Briefcase, Eye, EyeOff } from "lucide-react";
import { validateEmail, validatePassword } from "@/lib/validation";
import { PasswordStrengthIndicator } from "@/components/PasswordStrengthIndicator";
import { SocialLoginButtons, OrDivider } from "./SocialLoginButtons";

interface SignUpWizardProps {
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  accountType: "individual" | "company";
  setAccountType: (v: "individual" | "company") => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onGoogleSignIn: () => void;
  googleLoading: boolean;
}

export const SignUpWizard = ({
  email, setEmail, password, setPassword,
  confirmPassword, setConfirmPassword,
  accountType, setAccountType,
  loading, onSubmit,
  onGoogleSignIn, googleLoading,
}: SignUpWizardProps) => {
  // Creator vs Brand toggle drives onboarding fork (individual → /onboarding,
  // company → /company-onboarding). Default to individual.
  const [step, setStep] = useState(1);
  const totalSteps = 2;
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleNextStep = async () => {
    if (step === 1) {
      const ev = validateEmail(email);
      if (!ev.valid) { setEmailError(ev.error || ""); return; }
      setEmailError("");
      const { analytics } = await import("@/lib/analytics");
      analytics.featureUsed("signup_step", { step: 1, step_name: "email" });
      setStep(2);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pv = validatePassword(password);
    if (!pv.valid) { setPasswordError(pv.error || ""); return; }
    if (password !== confirmPassword) { setConfirmPasswordError("Passwords don't match"); return; }
    setPasswordError("");
    setConfirmPasswordError("");
    onSubmit(e);
  };

  return (
    <>
      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Step {step} of {totalSteps}</span>
          <span className="text-sm text-muted-foreground">
            {step === 1 && "Your email"}
            {step === 2 && "Create password"}
          </span>
        </div>
        <Progress value={(step / totalSteps) * 100} className="h-2" />
      </div>

      {/* Step 1: Email (with social login on top) */}
      {step === 1 && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-300">
          {/* Creator vs Brand toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-muted/50 border">
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
              onClick={() => setAccountType("company")}
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
          <p className="text-[11px] text-muted-foreground text-center -mt-2">
            {accountType === "individual"
              ? "Build your verified profile, get matched, find gigs."
              : "Hire creators, run campaigns, manage briefs."}
          </p>

          <SocialLoginButtons onGoogleSignIn={onGoogleSignIn} googleLoading={googleLoading} />
          <OrDivider text="or sign up with email" />

          <div className="space-y-2">
            <Label htmlFor="signup-email">Email Address</Label>
            <Input
              id="signup-email" type="email" placeholder="you@example.com"
              value={email} onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
              required className={`h-11 text-base ${emailError ? "border-destructive" : ""}`}
              autoComplete="email" autoFocus
            />
            {emailError && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {emailError}</p>}
          </div>

          <Button onClick={handleNextStep} variant="gradient" className="w-full">
            Continue<ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/auth?tab=signin" className="text-primary font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      )}

      {/* Step 2: Password */}
      {step === 2 && (
        <form onSubmit={handleSubmit} className="space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <div className="space-y-2">
            <Label htmlFor="signup-password">Create Password</Label>
            <div className="relative">
              <Input
                id="signup-password" type={showPassword ? "text" : "password"} placeholder="••••••••"
                value={password} onChange={(e) => { setPassword(e.target.value); setPasswordError(""); }}
                required minLength={8} className={`h-11 text-base pr-10 ${passwordError ? "border-destructive" : ""}`}
                autoComplete="new-password" autoFocus
              />
              <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </Button>
            </div>
            {passwordError && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {passwordError}</p>}
            <PasswordStrengthIndicator password={password} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirm-password" type={showPassword ? "text" : "password"} placeholder="••••••••"
                value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setConfirmPasswordError(""); }}
                required className={`h-11 text-base pr-10 ${confirmPasswordError ? "border-destructive" : ""}`}
                autoComplete="new-password"
              />
              <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </Button>
            </div>
            {confirmPasswordError && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {confirmPasswordError}</p>}
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1" disabled={loading}>
              <ArrowLeft className="mr-2 h-4 w-4" />Back
            </Button>
            <Button type="submit" variant="gradient" className="flex-1" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : "Create Account"}
            </Button>
          </div>
        </form>
      )}
    </>
  );
};
