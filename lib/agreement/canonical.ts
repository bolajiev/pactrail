import type { ActorRole, ApprovedTerms, Party } from "@/lib/types";

export interface DraftMilestone {
  id: string;
  description: string;
  acceptanceCriteria: string;
  amountBaseUnits: string;
  dueAt: string;
}

export interface AgreementDraft {
  title: string;
  summary: string;
  payer: Party;
  payee: Party;
  arbitrator: Party;
  token: { symbol: string; address: `0x${string}` | null; decimals: number };
  totalAmountBaseUnits: string;
  jurisdictionContext: string;
  chainId: number | null;
  milestones: DraftMilestone[];
}

export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => canonicalize(entry));
  if (value && typeof value === "object") {
    const input = value as Record<string, unknown>;
    return Object.keys(input)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        if (input[key] !== undefined) result[key] = canonicalize(input[key]);
        return result;
      }, {});
  }
  return value;
}

export function canonicalStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function buildApprovedTerms(draft: AgreementDraft): ApprovedTerms {
  return {
    version: "pactrail.terms.v1",
    title: draft.title.trim(),
    summary: draft.summary.trim(),
    parties: {
      payer: { name: draft.payer.name.trim(), address: normalizeAddress(draft.payer.address) },
      payee: { name: draft.payee.name.trim(), address: normalizeAddress(draft.payee.address) },
      arbitrator: {
        name: draft.arbitrator.name.trim(),
        address: normalizeAddress(draft.arbitrator.address),
      },
    },
    token: {
      symbol: draft.token.symbol,
      address: normalizeAddress(draft.token.address),
      decimals: draft.token.decimals,
    },
    totalAmountBaseUnits: draft.totalAmountBaseUnits,
    milestones: draft.milestones.map((milestone, index) => ({
      index,
      description: milestone.description.trim(),
      acceptanceCriteria: milestone.acceptanceCriteria.trim(),
      amountBaseUnits: milestone.amountBaseUnits,
      dueAt: new Date(milestone.dueAt).toISOString(),
    })),
    jurisdictionContext: draft.jurisdictionContext.trim(),
    chainId: draft.chainId,
  };
}

function normalizeAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  return address.toLowerCase();
}

export function partyRoleName(role: ActorRole): string {
  if (role === "payer") return "Payer";
  if (role === "payee") return "Payee";
  return "Arbitrator";
}

export function sumMilestoneAmounts(milestones: Array<{ amountBaseUnits: string }>): string {
  return milestones
    .reduce((sum, milestone) => sum + BigInt(milestone.amountBaseUnits || "0"), 0n)
    .toString();
}

export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function computeTermsHash(draft: AgreementDraft): Promise<{
  terms: ApprovedTerms;
  canonicalTerms: string;
  hash: string;
}> {
  const terms = buildApprovedTerms(draft);
  const canonicalTerms = canonicalStringify(terms);
  const hash = `0x${await sha256Hex(canonicalTerms)}`;
  return { terms, canonicalTerms, hash };
}

export function isBytes32(value: string): value is `0x${string}` {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

export function normalizeHexHash(value: string): `0x${string}` {
  if (isBytes32(value)) return value as `0x${string}`;
  if (/^[0-9a-fA-F]{64}$/.test(value)) return `0x${value}` as `0x${string}`;
  throw new Error("Hash must be 32 bytes of hexadecimal data.");
}
