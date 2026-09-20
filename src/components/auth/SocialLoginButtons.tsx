import { Button } from "@/components/ui/button";
import { Loader2, Chrome } from "lucide-react";

interface SocialLoginButtonsProps {
  onGoogleSignIn: () => void;
  googleLoading: boolean;
}

export const SocialLoginButtons = ({ onGoogleSignIn, googleLoading }: SocialLoginButtonsProps) => (
  <Button type="button" variant="outline" className="w-full h-11 gap-2" onClick={onGoogleSignIn} disabled={googleLoading}>
    {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Chrome className="h-4 w-4" />}
    Google
  </Button>
);

export const OrDivider = ({ text = "or continue with" }: { text?: string }) => (
  <div className="relative my-6">
    <div className="absolute inset-0 flex items-center">
      <span className="w-full border-t border-border" />
    </div>
    <div className="relative flex justify-center text-xs uppercase">
      <span className="bg-background px-2 text-muted-foreground">{text}</span>
    </div>
  </div>
);
