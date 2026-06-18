import { cn } from "@/lib/utils";
import logoUrl from "@/assets/unimate-logo.png";

type LogoSize = "sm" | "md" | "lg" | "xl";

const markSizes: Record<LogoSize, string> = {
  sm: "h-7 w-7",
  md: "h-9 w-9",
  lg: "h-12 w-12",
  xl: "h-16 w-16"
};

const wordmarkSizes: Record<LogoSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
  xl: "text-2xl"
};

export type UniMateLogoProps = {
  /** Show the "UNIMATE University" wordmark next to the mark. */
  withWordmark?: boolean;
  /** Wrap the mark in a white rounded badge so it reads on colored backgrounds. */
  badge?: boolean;
  /** Use light text for the wordmark on dark/colored backgrounds. */
  light?: boolean;
  size?: LogoSize;
  className?: string;
};

/**
 * Single source of truth for the UNIMATE University brand mark.
 * The source PNG has a white background, so `badge` keeps it legible on
 * gradients and dark surfaces.
 */
export function UniMateLogo({
  withWordmark = false,
  badge = false,
  light = false,
  size = "md",
  className
}: UniMateLogoProps) {
  const mark = (
    <img
      src={logoUrl}
      alt="UNIMATE University logo"
      className={cn(markSizes[size], "object-contain", badge ? "" : "rounded-md")}
      loading="eager"
      decoding="async"
    />
  );

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {badge ? (
        <span className={cn("grid shrink-0 place-items-center rounded-xl bg-white p-1 shadow-sm", markSizes[size])}>
          <img src={logoUrl} alt="UNIMATE University logo" className="h-full w-full object-contain" loading="eager" decoding="async" />
        </span>
      ) : (
        mark
      )}
      {withWordmark ? (
        <span className="leading-tight">
          <span className={cn("block font-extrabold", wordmarkSizes[size], light ? "text-white" : "text-brand-700")}>
            UNIMATE
          </span>
          <span className={cn("block text-[0.7em] font-semibold", light ? "text-blue-100" : "text-slate-500")}>
            University
          </span>
        </span>
      ) : null}
    </span>
  );
}
