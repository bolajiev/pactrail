"use client";

import * as React from "react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  FileSearch2,
  FileText,
  Flag,
  Gavel,
  Scale,
  Upload,
} from "lucide-react";
import type { Agreement, ActorRole, Milestone } from "@/lib/types";
import {
  canPerform,
  type AgreementAction,
  type PermissionResult,
} from "@/lib/agreement/permissions";
import { MilestoneStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HashDisplay } from "@/components/ui/primitives";
import {
  cn,
  daysFromNow,
  formatDate,
  formatDateTime,
  formatTokenAmount,
} from "@/lib/utils";

export interface MilestoneCardProps {
  agreement: Agreement;
  milestone: Milestone;
  role: ActorRole | null;
  walletBlockedReason: string | null;
  busyAction: AgreementAction | null;
  onOpenEvidence: (milestone: Milestone) => void;
  onSubmitEvidence: (milestone: Milestone) => void;
  onApprove: (milestone: Milestone) => void;
  onDispute: (milestone: Milestone) => void;
  onResolve: (milestone: Milestone) => void;
}

function actionButton(
  action: AgreementAction,
  permission: PermissionResult,
  walletBlockedReason: string | null,
  busyAction: AgreementAction | null,
  onAllowed: () => void,
  label: string,
  icon: React.ReactNode,
  variant: "primary" | "secondary" | "danger" = "primary",
) {
  const blockedReason = !permission.allowed ? permission.reason : walletBlockedReason;
  return (
    <Button
      key={action}
      type="button"
      size="sm"
      variant={variant}
      disabled={Boolean(blockedReason) || busyAction !== null}
      loading={busyAction === action}
      title={blockedReason ?? undefined}
      onClick={onAllowed}
    >
      {icon}
      {label}
    </Button>
  );
}

export function MilestoneCard({
  agreement,
  milestone,
  role,
  walletBlockedReason,
  busyAction,
  onOpenEvidence,
  onSubmitEvidence,
  onApprove,
  onDispute,
  onResolve,
}: MilestoneCardProps) {
  const submitPermission = canPerform(agreement, milestone, "submit_evidence", role);
  const approvePermission = canPerform(agreement, milestone, "approve", role);
  const disputePermission = canPerform(agreement, milestone, "dispute", role);
  const resolvePermission = canPerform(agreement, milestone, "resolve", role);
  const dueIn = daysFromNow(milestone.dueAt);
  const overdue =
    (milestone.status === "pending" ||
      milestone.status === "submitted" ||
      milestone.status === "disputed") &&
    dueIn < 0;

  const primaryPermission =
    milestone.status === "pending"
      ? submitPermission
      : milestone.status === "submitted"
        ? approvePermission
        : milestone.status === "disputed"
          ? resolvePermission
          : null;

  const primaryReason =
    primaryPermission && !primaryPermission.allowed ? primaryPermission.reason : null;

  const settled =
    milestone.status === "released" ||
    milestone.status === "resolved" ||
    milestone.status === "refunded";

  return (
    <div
      id={`milestone-${milestone.index + 1}`}
      className={cn(
        "relative pl-10 sm:pl-12",
        milestone.status === "disputed" && "rounded-xl",
      )}
    >
      <div
        className={cn(
          "absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border text-[0.68rem] font-bold sm:h-9 sm:w-9",
          settled
            ? "border-success-200 bg-success-50 text-success-700"
            : milestone.status === "disputed"
              ? "border-danger-200 bg-danger-50 text-danger-700"
              : milestone.status === "submitted"
                ? "border-clay-200 bg-clay-50 text-clay-700"
                : "border-line bg-canvas text-ink-mute",
        )}
      >
        {milestone.status === "released" ? (
          <Check className="h-4 w-4" />
        ) : milestone.status === "resolved" ? (
          <Scale className="h-4 w-4" />
        ) : milestone.status === "refunded" ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : milestone.status === "disputed" ? (
          <Flag className="h-3.5 w-3.5" />
        ) : (
          milestone.index + 1
        )}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[0.98rem] leading-snug text-ink">{milestone.description}</h3>
              <MilestoneStatusBadge status={milestone.status} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.68rem] text-ink-mute">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                {overdue ? (
                  <span className="font-semibold text-danger-600">
                    Overdue · due {formatDate(milestone.dueAt)}
                  </span>
                ) : (
                  <>Due {formatDate(milestone.dueAt)}</>
                )}
              </span>
              {milestone.evidence ? (
                <>
                  <span className="h-1 w-1 rounded-full bg-line-strong" />
                  <span>Evidence submitted {formatDate(milestone.evidence.submittedAt)}</span>
                </>
              ) : null}
            </div>
          </div>
          <div className="text-right">
            <p className="tabular text-[0.98rem] font-semibold text-ink">
              {formatTokenAmount(milestone.amountBaseUnits, agreement.token.decimals)}
            </p>
            <p className="text-[0.62rem] font-medium text-ink-faint">{agreement.token.symbol}</p>
          </div>
        </div>

        <p className="mt-2.5 text-[0.76rem] leading-relaxed text-ink-soft">
          <span className="font-semibold text-ink-mute">Acceptance: </span>
          {milestone.acceptanceCriteria}
        </p>

        {milestone.evidence ? (
          <div className="mt-3 rounded-xl border border-line bg-canvas/45 p-3.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-raised text-ink-mute">
                  <FileText className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[0.76rem] font-semibold text-ink">
                    {milestone.evidence.fileName ?? "Evidence reference"}
                  </p>
                  <p className="mt-0.5 text-[0.66rem] text-ink-mute">
                    {milestone.evidence.description}
                  </p>
                  <div className="mt-1.5">
                    <HashDisplay hash={milestone.evidence.hash} label="SHA-256" truncate />
                  </div>
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onOpenEvidence(milestone)}
              >
                <FileSearch2 className="h-3.5 w-3.5" />
                Review
              </Button>
            </div>
          </div>
        ) : null}

        {milestone.dispute ? (
          <div
            className={cn(
              "mt-3 rounded-xl border p-3.5",
              milestone.dispute.status === "open"
                ? "border-danger-200 bg-danger-50/60"
                : "border-line bg-canvas/45",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Flag
                  className={cn(
                    "h-3.5 w-3.5",
                    milestone.dispute.status === "open" ? "text-danger-600" : "text-ink-mute",
                  )}
                />
                <p className="text-[0.74rem] font-semibold text-ink">
                  {milestone.dispute.status === "open" ? "Dispute open" : "Dispute resolved"}
                </p>
              </div>
              <p className="text-[0.64rem] text-ink-faint">
                Opened by {milestone.dispute.raisedByLabel} ·{" "}
                {formatDateTime(milestone.dispute.raisedAt)}
              </p>
            </div>
            <p className="mt-1.5 text-[0.72rem] leading-relaxed text-ink-soft">
              {milestone.dispute.reason}
            </p>
            <div className="mt-1.5">
              <HashDisplay hash={milestone.dispute.reasonHash} label="Reason hash" truncate />
            </div>
            {milestone.dispute.resolution ? (
              <div className="mt-2.5 grid gap-2 rounded-lg border border-line bg-raised p-2.5 text-[0.68rem] sm:grid-cols-2">
                <p>
                  <span className="text-ink-faint">Payee award </span>
                  <span className="font-semibold text-ink">
                    {formatTokenAmount(
                      milestone.dispute.resolution.payeeAmountBaseUnits,
                      agreement.token.decimals,
                    )}
                  </span>
                </p>
                <p>
                  <span className="text-ink-faint">Payer refund </span>
                  <span className="font-semibold text-ink">
                    {formatTokenAmount(
                      milestone.dispute.resolution.payerRefundAmountBaseUnits,
                      agreement.token.decimals,
                    )}
                  </span>
                </p>
                <p className="sm:col-span-2">
                  <span className="text-ink-faint">Resolved by </span>
                  <span className="font-semibold text-ink">
                    {milestone.dispute.resolution.arbitratorLabel}
                  </span>
                  <span className="text-ink-faint">
                    {" "}
                    · {formatDateTime(milestone.dispute.resolution.resolvedAt)}
                  </span>
                </p>
                {milestone.dispute.resolution.note ? (
                  <p className="text-ink-mute sm:col-span-2">
                    {milestone.dispute.resolution.note}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {milestone.status === "pending"
            ? actionButton(
                "submit_evidence",
                submitPermission,
                walletBlockedReason,
                busyAction,
                () => onSubmitEvidence(milestone),
                "Submit evidence",
                <Upload className="h-3.5 w-3.5" />,
              )
            : null}
          {milestone.status === "submitted"
            ? actionButton(
                "approve",
                approvePermission,
                walletBlockedReason,
                busyAction,
                () => onApprove(milestone),
                "Approve & release",
                <CheckCircle2 className="h-3.5 w-3.5" />,
              )
            : null}
          {milestone.status === "pending" || milestone.status === "submitted"
            ? actionButton(
                "dispute",
                disputePermission,
                walletBlockedReason,
                busyAction,
                () => onDispute(milestone),
                "Raise dispute",
                <Flag className="h-3.5 w-3.5" />,
                "secondary",
              )
            : null}
          {milestone.status === "disputed"
            ? actionButton(
                "resolve",
                resolvePermission,
                walletBlockedReason,
                busyAction,
                () => onResolve(milestone),
                "Resolve split",
                <Gavel className="h-3.5 w-3.5" />,
                "danger",
              )
            : null}

          {milestone.status === "released" ? (
            <span className="flex items-center gap-1.5 text-[0.68rem] font-semibold text-success-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {formatTokenAmount(
                milestone.releasedAmountBaseUnits ?? milestone.amountBaseUnits,
                agreement.token.decimals,
              )}{" "}
              released to payee
            </span>
          ) : null}
          {milestone.status === "refunded" ? (
            <span className="flex items-center gap-1.5 text-[0.68rem] font-semibold text-ink-mute">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {formatTokenAmount(
                milestone.refundedAmountBaseUnits ?? milestone.amountBaseUnits,
                agreement.token.decimals,
              )}{" "}
              refunded to payer
            </span>
          ) : null}
          {milestone.status === "resolved" ? (
            <span className="flex items-center gap-1.5 text-[0.68rem] font-semibold text-navy-700">
              <Scale className="h-3.5 w-3.5" />
              {formatTokenAmount(
                milestone.releasedAmountBaseUnits ?? "0",
                agreement.token.decimals,
              )}{" "}
              paid ·{" "}
              {formatTokenAmount(
                milestone.refundedAmountBaseUnits ?? "0",
                agreement.token.decimals,
              )}{" "}
              refunded
            </span>
          ) : null}
        </div>

        {primaryReason && !walletBlockedReason ? (
          <p className="mt-1.5 text-[0.66rem] text-ink-faint">{primaryReason}</p>
        ) : null}
      </div>
    </div>
  );
}
