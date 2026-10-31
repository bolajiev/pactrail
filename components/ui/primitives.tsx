"use client";

import * as React from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { cn, truncateHash } from "@/lib/utils";

export function Card({
  className,
  children,
  as: Tag = "div",
}: {
  className?: string;
  children: React.ReactNode;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag
      className={cn(
        "rounded-2xl border border-line bg-surface shadow-[0_1px_0_rgba(255,255,255,0.6)_inset]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6", className)}>
      <div>
        <h3 className="text-[1.05rem] leading-snug text-ink">{title}</h3>
        {description ? (
          <p className="mt-1 max-w-xl text-[0.76rem] leading-relaxed text-ink-mute">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="mb-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-ink-faint">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-[2rem] leading-[1.1] text-ink sm:text-[2.45rem]">{title}</h1>
        {description ? (
          <p className="mt-2.5 max-w-xl text-[0.86rem] leading-relaxed text-ink-mute">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function CopyButton({
  value,
  label = "Copy",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "inline-flex items-center gap-1.5 text-[0.68rem] font-semibold text-ink-mute transition-colors hover:text-ink",
        className,
      )}
      aria-label={copied ? "Copied" : label}
    >
      {copied ? <Check className="h-3 w-3 text-success-600" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}

export function HashDisplay({
  hash,
  label,
  truncate = true,
  href,
  className,
}: {
  hash: string;
  label?: string;
  truncate?: boolean;
  href?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1", className)}>
      {label ? (
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-ink-faint">
          {label}
        </span>
      ) : null}
      <code className="hash min-w-0 text-ink-soft" title={hash}>
        {truncate ? truncateHash(hash) : hash}
      </code>
      <CopyButton value={hash} label="" />
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[0.68rem] font-semibold text-forest-700 hover:text-forest-900"
        >
          Explorer <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-surface/70 px-6 py-14 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-raised text-ink-mute">
          {icon}
        </div>
      ) : null}
      <h3 className="text-lg text-ink">{title}</h3>
      <p className="mt-1.5 max-w-md text-[0.8rem] leading-relaxed text-ink-mute">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-ink/[0.07]", className)} aria-hidden>
      <div
        className="h-full rounded-full bg-forest-600 transition-[width] duration-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function Stat({
  label,
  value,
  detail,
  icon,
  tone = "default",
  href,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
  href?: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-col justify-between rounded-2xl border border-line bg-surface px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-ink-faint">
          {label}
        </span>
        {icon ? <span className="text-ink-faint">{icon}</span> : null}
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div
            className={cn(
              "tabular font-serif text-[1.85rem] leading-none tracking-tight",
              tone === "success" && "text-success-700",
              tone === "warning" && "text-clay-700",
              tone === "danger" && "text-danger-600",
            )}
          >
            {value}
          </div>
          {detail ? <div className="mt-2 text-[0.72rem] text-ink-mute">{detail}</div> : null}
        </div>
        {href}
      </div>
    </div>
  );
}
