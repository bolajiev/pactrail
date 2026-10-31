import { isAddress } from "viem";
import type { AgreementDraft } from "@/lib/agreement/canonical";
import { sumMilestoneAmounts } from "@/lib/agreement/canonical";

export type CheckStatus = "pass" | "warn" | "fail";

export interface PreflightCheck {
  id: string;
  label: string;
  detail: string;
  status: CheckStatus;
}

export interface PreflightResult {
  checks: PreflightCheck[];
  ready: boolean;
  blockers: number;
  warnings: number;
}

export function runPreflight(
  draft: AgreementDraft,
  options: { live: boolean },
): PreflightResult {
  const checks: PreflightCheck[] = [];
  const names = [draft.payer.name, draft.payee.name, draft.arbitrator.name];
  const addresses = [draft.payer.address, draft.payee.address, draft.arbitrator.address];

  if (draft.title.trim().length > 0) {
    checks.push({
      id: "title",
      label: "Agreement title",
      detail: "The agreement has a human-readable title.",
      status: "pass",
    });
  } else {
    checks.push({
      id: "title",
      label: "Agreement title",
      detail: "Add a title so the record is identifiable.",
      status: "fail",
    });
  }

  if (names.every((name) => name.trim().length > 0)) {
    checks.push({
      id: "parties",
      label: "Named parties",
      detail: "Payer, payee, and arbitrator are identified.",
      status: "pass",
    });
  } else {
    checks.push({
      id: "parties",
      label: "Named parties",
      detail: "Every party needs a display name before terms can be confirmed.",
      status: "fail",
    });
  }

  if (options.live) {
    if (addresses.every((address) => address && isAddress(address))) {
      checks.push({
        id: "addresses",
        label: "Wallet addresses",
        detail: "All three roles have valid wallet addresses.",
        status: "pass",
      });
    } else {
      checks.push({
        id: "addresses",
        label: "Wallet addresses",
        detail: "Live agreements require valid wallet addresses for every role.",
        status: "fail",
      });
    }
  } else {
    checks.push({
      id: "addresses",
      label: "Wallet addresses",
      detail: "Demo agreements use role identities without wallet addresses.",
      status: "warn",
    });
  }

  const normalized = addresses.filter(Boolean).map((address) => address!.toLowerCase());
  if (new Set(normalized).size === (options.live ? 3 : normalized.length)) {
    checks.push({
      id: "distinct",
      label: "Separated roles",
      detail: "Payer, payee, and arbitrator are distinct identities.",
      status: "pass",
    });
  } else {
    checks.push({
      id: "distinct",
      label: "Separated roles",
      detail: "The payer, payee, and arbitrator must be different parties.",
      status: "fail",
    });
  }

  const milestoneSum = sumMilestoneAmounts(draft.milestones);
  if (draft.milestones.some((milestone) => BigInt(milestone.amountBaseUnits || "0") <= 0n)) {
    checks.push({
      id: "milestone_amounts",
      label: "Milestone amounts",
      detail: "Every milestone needs an amount greater than zero.",
      status: "fail",
    });
  } else {
    checks.push({
      id: "milestone_amounts",
      label: "Milestone amounts",
      detail: "Every milestone carries a positive settlement amount.",
      status: "pass",
    });
  }

  if (draft.milestones.length === 0) {
    checks.push({
      id: "milestones",
      label: "Milestone schedule",
      detail: "Add at least one milestone.",
      status: "fail",
    });
  } else if (milestoneSum !== draft.totalAmountBaseUnits) {
    checks.push({
      id: "schedule_total",
      label: "Schedule total",
      detail: "Milestone amounts must equal the agreement total.",
      status: "fail",
    });
  } else if (BigInt(draft.totalAmountBaseUnits) <= 0n) {
    checks.push({
      id: "schedule_total",
      label: "Schedule total",
      detail: "The agreement total must be greater than zero.",
      status: "fail",
    });
  } else {
    checks.push({
      id: "schedule_total",
      label: "Milestone schedule",
      detail: `${draft.milestones.length} milestone${
        draft.milestones.length === 1 ? "" : "s"
      } total the full agreement value.`,
      status: "pass",
    });
  }

  const now = Date.now();
  const invalidDates = draft.milestones.filter(
    (milestone) => !milestone.dueAt || new Date(milestone.dueAt).getTime() <= now,
  );
  if (invalidDates.length > 0) {
    checks.push({
      id: "due_dates",
      label: "Milestone deadlines",
      detail: "Every milestone needs a future due date.",
      status: "fail",
    });
  } else {
    checks.push({
      id: "due_dates",
      label: "Milestone deadlines",
      detail: "Every milestone has a future deadline.",
      status: "pass",
    });
  }

  if (draft.milestones.every((milestone) => milestone.acceptanceCriteria.trim().length > 0)) {
    checks.push({
      id: "acceptance",
      label: "Acceptance criteria",
      detail: "Each milestone states what evidence the payer will assess.",
      status: "pass",
    });
  } else {
    checks.push({
      id: "acceptance",
      label: "Acceptance criteria",
      detail:
        "Add acceptance criteria so the payer and payee share the same release standard.",
      status: "warn",
    });
  }

  if (draft.jurisdictionContext.trim().length > 0) {
    checks.push({
      id: "jurisdiction",
      label: "Context recorded",
      detail: "Jurisdiction or governing-law context is recorded for the parties.",
      status: "pass",
    });
  } else {
    checks.push({
      id: "jurisdiction",
      label: "Context missing",
      detail: "Record jurisdiction context for clarity. This is not a compliance check.",
      status: "warn",
    });
  }

  if (options.live && !draft.token.address) {
    checks.push({
      id: "token",
      label: "Test token configured",
      detail: "Deploy and configure the escrow token before using live mode.",
      status: "fail",
    });
  } else {
    checks.push({
      id: "token",
      label: "Settlement token",
      detail: `${draft.token.symbol} is the agreed settlement asset.`,
      status: "pass",
    });
  }

  const blockers = checks.filter((check) => check.status === "fail").length;
  const warnings = checks.filter((check) => check.status === "warn").length;
  return { checks, ready: blockers === 0, blockers, warnings };
}
