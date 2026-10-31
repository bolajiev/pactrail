import * as React from "react";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-xl border border-line-strong bg-raised px-3.5 text-[0.86rem] text-ink placeholder:text-ink-faint transition-colors hover:border-ink/25 focus:border-forest-600 focus:ring-2 focus:ring-forest-600/10 disabled:cursor-not-allowed disabled:bg-ink/[0.03] disabled:text-ink-mute";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(base, "h-10", className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(base, "min-h-24 resize-y py-2.5 leading-relaxed", className)} {...props} />;
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(base, "h-10 appearance-none pr-9", className)} {...props}>
      {children}
    </select>
  );
});

export function Label({
  htmlFor,
  children,
  hint,
  required,
  className,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("mb-1.5 flex items-baseline justify-between gap-3", className)}>
      <label htmlFor={htmlFor} className="text-[0.76rem] font-semibold text-ink-soft">
        {children}
        {required ? <span className="ml-0.5 text-clay-600">*</span> : null}
      </label>
      {hint ? <span className="text-[0.68rem] text-ink-faint">{hint}</span> : null}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
  description,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  description?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} hint={hint} required={required}>
        {label}
      </Label>
      {children}
      {description && !error ? (
        <p className="mt-1.5 text-[0.7rem] leading-relaxed text-ink-faint">{description}</p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1.5 text-[0.7rem] font-medium text-danger-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Checkbox({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        "mt-0.5 h-4 w-4 shrink-0 rounded border-line-strong text-forest-700 accent-forest-700 focus:ring-forest-600",
        className,
      )}
      {...props}
    />
  );
}

export function FormNote({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "warning" | "danger";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3.5 py-2.5 text-[0.75rem] leading-relaxed",
        tone === "neutral" && "border-line bg-canvas/60 text-ink-mute",
        tone === "warning" && "border-clay-200 bg-clay-50 text-clay-800",
        tone === "danger" && "border-danger-200 bg-danger-50 text-danger-700",
      )}
    >
      {children}
    </div>
  );
}
