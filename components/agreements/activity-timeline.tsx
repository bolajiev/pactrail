"use client";

import {
  CheckCircle2,
  CircleDollarSign,
  FileCheck2,
  FilePenLine,
  Flag,
  Gavel,
  RotateCcw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import type { ActivityEvent, ActivityKind } from "@/lib/types";
import { OriginBadge } from "@/components/ui/badge";
import { HashDisplay } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/utils";
import { txExplorerUrl } from "@/lib/chain/config";

const icons: Record<ActivityKind, React.ReactNode> = {
  draft_saved: <FilePenLine className="h-3.5 w-3.5" />,
  terms_confirmed: <FileCheck2 className="h-3.5 w-3.5" />,
  agreement_created: <FilePenLine className="h-3.5 w-3.5" />,
  funded: <CircleDollarSign className="h-3.5 w-3.5" />,
  evidence_submitted: <Upload className="h-3.5 w-3.5" />,
  milestone_approved: <CheckCircle2 className="h-3.5 w-3.5" />,
  dispute_raised: <Flag className="h-3.5 w-3.5" />,
  dispute_resolved: <Gavel className="h-3.5 w-3.5" />,
  refund_issued: <RotateCcw className="h-3.5 w-3.5" />,
  agreement_completed: <ShieldCheck className="h-3.5 w-3.5" />,
  evidence_verified: <FileCheck2 className="h-3.5 w-3.5" />,
};

export function ActivityTimeline({
  events,
  limit,
  showAgreement = false,
}: {
  events: ActivityEvent[];
  limit?: number;
  showAgreement?: boolean;
}) {
  const sorted = [...events].sort(
    (left, right) => new Date(right.at).getTime() - new Date(left.at).getTime(),
  );
  const visible = typeof limit === "number" ? sorted.slice(0, limit) : sorted;

  if (visible.length === 0) {
    return (
      <div className="px-5 py-10 text-center text-[0.78rem] text-ink-mute">
        No activity recorded yet.
      </div>
    );
  }

  return (
    <ol className="relative">
      {visible.map((event, index) => {
        const href = txExplorerUrl(event.chainId, event.txHash);
        return (
          <li
            key={event.id}
            className="relative flex gap-3.5 border-b border-line/70 px-5 py-4 last:border-0 sm:px-6"
          >
            <div className="relative flex flex-col items-center">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-canvas text-ink-mute">
                {icons[event.kind]}
              </span>
              {index < visible.length - 1 ? (
                <span className="mt-1 w-px flex-1 bg-line" aria-hidden />
              ) : null}
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-[0.78rem] font-medium leading-relaxed text-ink">
                  {event.summary}
                </p>
                <OriginBadge origin={event.origin} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.66rem] text-ink-faint">
                <span className="font-semibold text-ink-mute">{event.actorLabel}</span>
                <span aria-hidden>·</span>
                <time dateTime={event.at}>{formatDateTime(event.at)}</time>
                {showAgreement ? (
                  <>
                    <span aria-hidden>·</span>
                    <span className="capitalize">{event.mode} record</span>
                  </>
                ) : null}
              </div>
              {event.detail ? (
                <p className="mt-1 line-clamp-2 text-[0.7rem] leading-relaxed text-ink-mute">
                  {event.detail}
                </p>
              ) : null}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                {event.txHash ? (
                  <HashDisplay
                    hash={event.txHash}
                    label={event.mode === "live" ? "Transaction" : "Transaction"}
                    href={href}
                    truncate
                  />
                ) : event.hashRef ? (
                  <HashDisplay hash={event.hashRef} label="Reference" truncate />
                ) : null}
                {event.blockNumber ? (
                  <span className="text-[0.64rem] text-ink-faint">
                    Block {event.blockNumber}
                  </span>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
