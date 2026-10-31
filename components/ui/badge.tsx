import * as React from "react";
import { Clock3, CircleDot, FileClock, FlaskConical, Link2, Scale, ShieldCheck, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgreementStatus, MilestoneStatus, ActivityOrigin } from "@/lib/types";
import {
  AGREEMENT_STATUS_LABELS,
  MILESTONE_STATUS_LABELS,
} from "@/lib/agreement/status";

type Tone = "neutral" | "green" | "amber" | "red" | "blue" | "sand" | "outline";

const tones: Record<Tone, string> = {
  neutral: "bg-ink/[0.055] text-ink-soft border-ink/10",
  green: "bg-success-50 text-success-700 border-success-200",
  amber: "bg-clay-50 text-clay-700 border-clay-200",
  red: "bg-danger-50 text-danger-700 border-danger-200",
  blue: "bg-navy-50 text-navy-700 border-navy-200",
  sand: "bg-canvas text-ink-soft border-line-strong",
  outline: "bg-transparent text-ink-mute border-line-strong",
};

export function Badge({
  tone = "neutral",
  className,
  dot,
  children,
}: {
  tone?: Tone;
  className?: string;
  dot?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-[0.18rem] text-[0.68rem] font-semibold tracking-[0.01em] whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}

const agreementTone: Record<AgreementStatus, Tone> = {
  draft: "neutral",
  awaiting_funding: "amber",
  active: "blue",
  awaiting_approval: "sand",
  disputed: "red",
  completed: "green",
};

const agreementIcon: Record<AgreementStatus, React.ReactNode> = {
  draft: <FileClock className="h-3 w-3" />,
  awaiting_funding: <Clock3 className="h-3 w-3" />,
  active: <CircleDot className="h-3 w-3" />,
  awaiting_approval: <Clock3 className="h-3 w-3" />,
  disputed: <Scale className="h-3 w-3" />,
  completed: <ShieldCheck className="h-3 w-3" />,
};

export function AgreementStatusBadge({
  status,
  className,
}: {
  status: AgreementStatus;
  className?: string;
}) {
  return (
    <Badge tone={agreementTone[status]} className={className}>
      {agreementIcon[status]}
      {AGREEMENT_STATUS_LABELS[status]}
    </Badge>
  );
}

const milestoneTone: Record<MilestoneStatus, Tone> = {
  pending: "amber",
  submitted: "sand",
  released: "green",
  disputed: "red",
  resolved: "blue",
  refunded: "neutral",
};

export function MilestoneStatusBadge({ status }: { status: MilestoneStatus }) {
  return (
    <Badge tone={milestoneTone[status]} dot>
      {MILESTONE_STATUS_LABELS[status]}
    </Badge>
  );
}

export function OriginBadge({ origin }: { origin: ActivityOrigin }) {
  if (origin === "onchain") {
    return (
      <Badge tone="green">
        <Link2 className="h-3 w-3" />
        On-chain
      </Badge>
    );
  }
  if (origin === "demo") {
    return (
      <Badge tone="sand">
        <FlaskConical className="h-3 w-3" />
        Demo event
      </Badge>
    );
  }
  return (
    <Badge tone="outline">
      <FileClock className="h-3 w-3" />
      Off-chain
    </Badge>
  );
}

export function DemoBadge({ label = "Sample" }: { label?: string }) {
  return (
    <Badge tone="sand">
      <FlaskConical className="h-3 w-3" />
      {label}
    </Badge>
  );
}

export function UnsupportedBadge() {
  return (
    <Badge tone="red">
      <XCircle className="h-3 w-3" />
      Unsupported network
    </Badge>
  );
}
