import type { AgreementAnalysis, WorkspaceMode } from "@/lib/types";
import type { AgreementDraft } from "@/lib/agreement/canonical";
import { dateAtUtcMidnight, parseAmountToBaseUnits, toDateInput, uid } from "@/lib/utils";

export interface WizardMilestone {
  key: string;
  description: string;
  acceptanceCriteria: string;
  amount: string;
  dueDate: string;
}

export interface WizardForm {
  title: string;
  summary: string;
  payerName: string;
  payeeName: string;
  arbitratorName: string;
  payerAddress: string;
  payeeAddress: string;
  arbitratorAddress: string;
  jurisdiction: string;
  milestones: WizardMilestone[];
}

export interface WizardToken {
  symbol: string;
  address: `0x${string}` | null;
  decimals: number;
}

export function emptyMilestone(): WizardMilestone {
  return {
    key: uid("ms"),
    description: "",
    acceptanceCriteria: "",
    amount: "",
    dueDate: "",
  };
}

export function blankForm(): WizardForm {
  return {
    title: "",
    summary: "",
    payerName: "",
    payeeName: "",
    arbitratorName: "",
    payerAddress: "",
    payeeAddress: "",
    arbitratorAddress: "",
    jurisdiction: "",
    milestones: [emptyMilestone()],
  };
}

function cleanAmount(value: string | null): string {
  if (!value) return "";
  return value.replace(/[$,\s]/g, "");
}

export function analysisToForm(
  analysis: AgreementAnalysis,
  current: WizardForm,
): WizardForm {
  const party = (role: "payer" | "payee" | "arbitrator") =>
    analysis.parties.find((entry) => entry.role === role);
  const payer = party("payer");
  const payee = party("payee");
  const arbitrator = party("arbitrator");

  const milestones =
    analysis.milestones.length > 0
      ? analysis.milestones.map((milestone) => ({
          key: uid("ms"),
          description: milestone.description ?? "",
          acceptanceCriteria: milestone.acceptance_criteria ?? "",
          amount: cleanAmount(milestone.amount),
          dueDate: milestone.due_date ? toDateInput(milestone.due_date) : "",
        }))
      : [emptyMilestone()];

  return {
    ...current,
    title: analysis.title.value ?? current.title,
    summary: analysis.scope.value ?? current.summary,
    payerName: payer?.name ?? current.payerName,
    payeeName: payee?.name ?? current.payeeName,
    arbitratorName: arbitrator?.name ?? current.arbitratorName,
    jurisdiction: analysis.jurisdiction.value ?? current.jurisdiction,
    milestones,
  };
}

export function formToDraft(
  form: WizardForm,
  token: WizardToken,
  mode: WorkspaceMode,
  chainId: number | null,
): AgreementDraft {
  const baseAmounts = form.milestones.map((milestone) => {
    const parsed = parseAmountToBaseUnits(milestone.amount, token.decimals);
    return parsed.ok ? parsed.value : "0";
  });
  const total = baseAmounts.reduce((sum, amount) => sum + BigInt(amount), 0n);

  return {
    title: form.title.trim(),
    summary: form.summary.trim(),
    payer: {
      role: "payer",
      name: form.payerName.trim(),
      address: mode === "live" ? form.payerAddress.trim() || null : null,
    },
    payee: {
      role: "payee",
      name: form.payeeName.trim(),
      address: mode === "live" ? form.payeeAddress.trim() || null : null,
    },
    arbitrator: {
      role: "arbitrator",
      name: form.arbitratorName.trim(),
      address: mode === "live" ? form.arbitratorAddress.trim() || null : null,
    },
    token,
    totalAmountBaseUnits: total.toString(),
    jurisdictionContext: form.jurisdiction.trim(),
    chainId: mode === "live" ? chainId : null,
    milestones: form.milestones.map((milestone, index) => ({
      id: milestone.key,
      description: milestone.description.trim(),
      acceptanceCriteria: milestone.acceptanceCriteria.trim(),
      amountBaseUnits: baseAmounts[index],
      dueAt: milestone.dueDate ? dateAtUtcMidnight(milestone.dueDate) : "",
    })),
  };
}

export function draftTotal(
  form: WizardForm,
  decimals: number,
): { total: bigint; invalid: boolean } {
  let total = 0n;
  let invalid = false;
  for (const milestone of form.milestones) {
    const parsed = parseAmountToBaseUnits(milestone.amount, decimals);
    if (!parsed.ok) {
      invalid = true;
      continue;
    }
    total += BigInt(parsed.value);
  }
  return { total, invalid };
}

export function firstInvalidMilestone(form: WizardForm, decimals: number): number | null {
  for (let index = 0; index < form.milestones.length; index += 1) {
    const milestone = form.milestones[index];
    if (!milestone.description.trim()) return index;
    if (!parseAmountToBaseUnits(milestone.amount, decimals).ok) return index;
    if (!milestone.dueDate || Number.isNaN(new Date(`${milestone.dueDate}T23:59:59Z`).getTime())) {
      return index;
    }
  }
  return null;
}
