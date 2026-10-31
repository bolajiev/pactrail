import type {
  ActorRole,
  Agreement,
  Milestone,
  WorkspaceMode,
} from "@/lib/types";
import { deriveAgreementStatus } from "@/lib/agreement/status";

export type AgreementAction =
  | "fund"
  | "submit_evidence"
  | "approve"
  | "dispute"
  | "resolve";

export interface PermissionResult {
  allowed: boolean;
  reason: string | null;
}

const allowed = (): PermissionResult => ({ allowed: true, reason: null });
const denied = (reason: string): PermissionResult => ({ allowed: false, reason });

export function roleForAddress(agreement: Agreement, address?: string | null): ActorRole | null {
  if (!address) return null;
  const normalized = address.toLowerCase();
  if (agreement.payer.address?.toLowerCase() === normalized) return "payer";
  if (agreement.payee.address?.toLowerCase() === normalized) return "payee";
  if (agreement.arbitrator.address?.toLowerCase() === normalized) return "arbitrator";
  return null;
}

export function canPerform(
  agreement: Agreement,
  milestone: Milestone | undefined,
  action: AgreementAction,
  role: ActorRole | null,
): PermissionResult {
  if (!role) return denied("Connect the wallet assigned to a party in this agreement.");
  if (!agreement.termsApprovedAt) return denied("The terms have not been confirmed.");

  const funded = Boolean(agreement.fundedAt);
  const terminal = deriveAgreementStatus(agreement) === "completed";

  if (action === "fund") {
    if (role !== "payer") return denied("Only the payer can fund this agreement.");
    if (funded) return denied("This agreement is already funded.");
    return allowed();
  }

  if (!funded) return denied("The payer must fund the escrow first.");
  if (terminal) return denied("This agreement is complete.");

  if (!milestone) return denied("Select a milestone.");

  if (action === "submit_evidence") {
    if (role !== "payee") return denied("Only the payee can submit evidence.");
    if (milestone.status !== "pending") {
      return denied("Evidence can only be submitted for a milestone awaiting evidence.");
    }
    return allowed();
  }

  if (action === "approve") {
    if (role !== "payer") return denied("Only the payer can approve and release this milestone.");
    if (milestone.status !== "submitted") {
      return denied("This milestone does not have evidence awaiting approval.");
    }
    return allowed();
  }

  if (action === "dispute") {
    if (role !== "payer" && role !== "payee") {
      return denied("Only the payer or payee can open a dispute.");
    }
    if (milestone.status !== "pending" && milestone.status !== "submitted") {
      return denied("Only an unreleased milestone can be disputed.");
    }
    return allowed();
  }

  if (action === "resolve") {
    if (role !== "arbitrator") return denied("Only the named arbitrator can resolve a dispute.");
    if (milestone.status !== "disputed") return denied("This milestone is not in dispute.");
    return allowed();
  }

  return denied("Unknown action.");
}

export function actorLabel(agreement: Agreement, role: ActorRole): string {
  if (role === "payer") return agreement.payer.name;
  if (role === "payee") return agreement.payee.name;
  return agreement.arbitrator.name;
}

export function isDemoRoleEditable(mode: WorkspaceMode): boolean {
  return mode === "demo";
}
