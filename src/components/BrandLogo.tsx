import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import kMarkAsset from "@/assets/brand/kretopia-k-mark.png.asset.json";
import wordmarkAsset from "@/assets/brand/kretopia-wordmark.png.asset.json";


interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  showBeta?: boolean;
  /** true links to "/" (default, back-compat); a string links there instead
   *  -- e.g. Navbar passes "/landing" so the logo always reaches the real
   *  marketing page, even for a signed-in user (for whom "/" itself renders
   *  their Today dashboard, not the guest landing content). */
  linkToHome?: boolean | string;
  className?: string;
  /** Show only the wordmark image ("kretopia") */
  textOnly?: boolean;
  /** Show only the K mark icon */
  iconOnly?: boolean;
  /** Use the full official lockup PNG (K + kretopia together). Overrides icon/textOnly. */
  lockup?: boolean;
  /** Kept for API back-compat; the official assets read correctly on light + dark. */
  onDark?: boolean;
}

const sizeConfig = {
  sm: { mark: "h-7 w-7",   text: "h-5",  gap: "gap-2",   lockup: "h-7"  },
  md: { mark: "h-9 w-9",   text: "h-6",  gap: "gap-2.5", lockup: "h-9"  },
  lg: { mark: "h-12 w-12", text: "h-9",  gap: "gap-3",   lockup: "h-12" },
} as const;

export function BrandLogo({
  size = "md",
  showBeta = false,
  linkToHome = false,
  className,
  textOnly = false,
  iconOnly = false,
  lockup = false,
}: BrandLogoProps) {
  const cfg = sizeConfig[size];

  const showMark = lockup || !textOnly;
  const showWord = lockup || !iconOnly;

  const content = (
    <span className={cn("flex items-center shrink-0", cfg.gap, className)}>
      {showMark && (
        <img
          src={kMarkAsset.url}
          alt="Kretopia"
          className={cn(cfg.mark, "select-none object-contain")}
          draggable={false}
        />
      )}
      {showWord && (
        <img
          src={wordmarkAsset.url}
          alt="kretopia"
          className={cn(cfg.text, "w-auto select-none object-contain")}
          draggable={false}
        />
      )}
      {showBeta && (
        <span className="hidden sm:inline-flex items-center border border-white/20 text-white/70 text-[9px] uppercase tracking-[0.18em] font-semibold px-1.5 py-0.5 rounded-md leading-none">
          Beta
        </span>
      )}
    </span>
  );


  if (linkToHome) {
    return (
      <Link to={typeof linkToHome === "string" ? linkToHome : "/"} aria-label="Kretopia Home">
        {content}
      </Link>
    );
  }

  return content;
}
