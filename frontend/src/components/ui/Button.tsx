import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white shadow-sm hover:bg-brand-700 focus-visible:ring-brand-500",
  secondary: "bg-brand-50 text-brand-700 hover:bg-brand-100 focus-visible:ring-brand-500",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-300",
  outline: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-brand-500",
  danger: "bg-red-50 text-red-700 hover:bg-red-100 focus-visible:ring-red-300"
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, type = "button", variant = "primary", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className
      )}
      {...props}
    />
  )
);

Button.displayName = "Button";
