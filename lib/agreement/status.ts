import type {
  Agreement,
  AgreementStatus,
  Milestone,
  MilestoneStatus,
} from "@/lib/types";

export const AGREEMENT_STATUS_LABELS: Record<AgreementStatus, string> = {
  draft: "Draft",
  awaiting_funding: "Awaiting funding",
  active: "Active",
  awaiting_approval: "Awaiting approval",
  disputed: "Disputed",
  completed: "Completed",
};

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  pending: "Awaiting evidence",
  submitted: "Awaiting approval",
  released: "Released",
  disputed: "Disputed",
  resolved: "Resolved",
  refunded: "Refunded",
};

export function isTerminalMilestone(status: MilestoneStatus): boolean {
  return status === "released" || status === "resolved" || status === "refunded";
}

export function deriveAgreementStatus(agreement: Agreement): AgreementStatus {
  if (!agreement.termsApprovedAt) return "draft";
  if (!agreement.fundedAt) return "awaiting_funding";
  if (agreement.milestones.some((milestone) => milestone.status === "disputed")) {
    return "disputed";
  }
  if (agreement.milestones.some((milestone) => milestone.status === "submitted")) {
    return "awaiting_approval";
  }
  if (agreement.milestones.every((milestone) => isTerminalMilestone(milestone.status))) {
    return "completed";
  }
  return "active";
}

export function fundedEscrowBaseUnits(agreement: Agreement): bigint {
  if (!agreement.fundedAt) return 0n;
  return agreement.milestones.reduce((total, milestone) => {
    if (isTerminalMilestone(milestone.status)) return total;
    return total + BigInt(milestone.amountBaseUnits);
  }, 0n);
}

export function releasedBaseUnits(agreement: Agreement): bigint {
  return agreement.milestones.reduce((total, milestone) => {
    if (milestone.status === "released") {
      return total + BigInt(milestone.releasedAmountBaseUnits ?? milestone.amountBaseUnits);
    }
    if (milestone.status === "resolved") {
      return total + BigInt(milestone.releasedAmountBaseUnits ?? "0");
    }
    return total;
  }, 0n);
}

export function refundedBaseUnits(agreement: Agreement): bigint {
  return agreement.milestones.reduce((total, milestone) => {
    if (milestone.status === "refunded") {
      return total + BigInt(milestone.refundedAmountBaseUnits ?? milestone.amountBaseUnits);
    }
    if (milestone.status === "resolved") {
      return total + BigInt(milestone.refundedAmountBaseUnits ?? "0");
    }
    return total;
  }, 0n);
}

export function nextMilestone(agreement: Agreement): Milestone | undefined {
  return (
    agreement.milestones.find((milestone) => milestone.status === "disputed") ??
    agreement.milestones.find((milestone) => milestone.status === "submitted") ??
    agreement.milestones.find((milestone) => milestone.status === "pending") ??
    agreement.milestones.find((milestone) => !isTerminalMilestone(milestone.status))
  );
}

export function milestoneProgress(agreement: Agreement): number {
  if (agreement.milestones.length === 0) return 0;
  const settled = agreement.milestones.filter((milestone) =>
    isTerminalMilestone(milestone.status),
  ).length;
  return Math.round((settled / agreement.milestones.length) * 100);
}

export function nextActionLabel(agreement: Agreement): string {
  const status = deriveAgreementStatus(agreement);
  const milestone = nextMilestone(agreement);
  if (status === "awaiting_funding") return "Fund escrow";
  if (status === "completed") return "Completed";
  if (!milestone) return "No action";
  if (milestone.status === "disputed") return "Arbitrator resolution";
  if (milestone.status === "submitted") return "Client approval";
  if (milestone.status === "pending") return "Evidence due";
  return "In progress";
}
