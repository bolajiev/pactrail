import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-forest-800 text-white border border-forest-800 hover:bg-forest-900 hover:border-forest-900 shadow-sm disabled:bg-forest-800/50 disabled:border-forest-800/30",
  secondary:
    "bg-raised text-ink border border-line-strong hover:border-ink/40 hover:bg-white disabled:text-ink-faint",
  ghost:
    "bg-transparent text-ink-soft border border-transparent hover:bg-ink/[0.045] hover:text-ink disabled:text-ink-faint",
  subtle:
    "bg-forest-50 text-forest-800 border border-forest-100 hover:bg-forest-100 disabled:opacity-60",
  danger:
    "bg-danger-600 text-white border border-danger-600 hover:bg-danger-700 hover:border-danger-700 disabled:bg-danger-600/50",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[0.78rem] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-[0.84rem] gap-2 rounded-xl",
  lg: "h-11 px-5 text-sm gap-2 rounded-xl",
  icon: "h-9 w-9 rounded-lg",
};

export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    "inline-flex items-center justify-center font-semibold transition-colors duration-150 disabled:cursor-not-allowed select-none whitespace-nowrap",
    variants[variant],
    sizes[size],
    className,
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingText?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, loadingText, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={buttonStyles({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
      {loading ? (loadingText ?? children) : children}
    </button>
  );
});
