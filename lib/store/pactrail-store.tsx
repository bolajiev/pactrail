"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { sha256, stringToBytes } from "viem";
import type {
  ActivityEvent,
  ActorRole,
  Agreement,
  ChainReference,
  EvidenceRecord,
  Milestone,
  StoreState,
  WorkspaceMode,
} from "@/lib/types";
import type { AgreementDraft } from "@/lib/agreement/canonical";
import { canPerform, actorLabel } from "@/lib/agreement/permissions";
import { isTerminalMilestone } from "@/lib/agreement/status";
import { createDemoStore } from "@/lib/demo/seed";
import { formatTokenAmount, uid } from "@/lib/utils";

const STORAGE_KEY = "pactrail.store.v1";

export interface ActionContext {
  actorRole: ActorRole;
  actorName?: string;
  txHash?: `0x${string}`;
  chainId?: number;
  blockNumber?: string;
}

export interface CreateAgreementInput {
  draft: AgreementDraft;
  terms: Agreement["terms"];
  termsHash: string;
  mode: WorkspaceMode;
  chain?: ChainReference | null;
  sourceText?: string;
  sourceSaved: boolean;
}

interface PactRailContextValue {
  state: StoreState;
  hydrated: boolean;
  setMode: (mode: WorkspaceMode) => void;
  setDemoActor: (role: ActorRole) => void;
  createAgreement: (input: CreateAgreementInput & { txHash?: `0x${string}` }) => Agreement;
  fundAgreement: (agreementId: string, context: ActionContext) => void;
  submitEvidence: (
    agreementId: string,
    milestoneId: string,
    evidence: EvidenceRecord,
    context: ActionContext,
  ) => void;
  approveMilestone: (
    agreementId: string,
    milestoneId: string,
    context: ActionContext,
  ) => void;
  raiseDispute: (
    agreementId: string,
    milestoneId: string,
    reason: string,
    context: ActionContext,
  ) => void;
  resolveDispute: (
    agreementId: string,
    milestoneId: string,
    payeeAmountBaseUnits: string,
    payerRefundBaseUnits: string,
    note: string,
    context: ActionContext,
  ) => void;
  recordEvidenceVerification: (
    agreementId: string,
    milestoneId: string,
    matched: boolean,
    fileName?: string,
  ) => void;
  resetDemoWorkspace: () => void;
  clearAllLocalData: () => void;
}

const PactRailContext = createContext<PactRailContextValue | null>(null);

function hashText(value: string): `0x${string}` {
  return sha256(stringToBytes(value));
}

function nowIso(): string {
  return new Date().toISOString();
}

function originFor(agreement: Agreement, context: ActionContext): ActivityEvent["origin"] {
  if (context.txHash) return "onchain";
  return agreement.mode === "demo" ? "demo" : "offchain";
}

function makeEvent(
  agreement: Agreement,
  kind: ActivityEvent["kind"],
  context: ActionContext,
  summary: string,
  options: Partial<ActivityEvent> = {},
): ActivityEvent {
  return {
    id: uid("evt"),
    agreementId: agreement.id,
    mode: agreement.mode,
    kind,
    actorRole: context.actorRole,
    actorLabel:
      context.actorName ?? actorLabel(agreement, context.actorRole),
    summary,
    at: nowIso(),
    origin: originFor(agreement, context),
    txHash: context.txHash,
    chainId: context.chainId ?? agreement.chain?.chainId,
    blockNumber: context.blockNumber,
    ...options,
  };
}

function attachCompletion(
  agreement: Agreement,
  context: ActionContext,
): { agreement: Agreement; event: ActivityEvent | null } {
  if (agreement.completedAt) return { agreement, event: null };
  if (agreement.milestones.length === 0) return { agreement, event: null };
  if (!agreement.milestones.every((milestone) => isTerminalMilestone(milestone.status))) {
    return { agreement, event: null };
  }
  const completedAt = nowIso();
  const completed = { ...agreement, completedAt, updatedAt: completedAt };
  return {
    agreement: completed,
    event: makeEvent(completed, "agreement_completed", context, "All milestones settled. Agreement marked complete."),
  };
}

function money(agreement: Agreement, baseUnits: string, symbol = true): string {
  const amount = formatTokenAmount(baseUnits, agreement.token.decimals, {
    symbol: "",
    minimumFractionDigits: 2,
  });
  return symbol ? `${amount} ${agreement.token.symbol}` : amount;
}

function ensurePermission(
  agreement: Agreement,
  milestone: Milestone | undefined,
  action: Parameters<typeof canPerform>[2],
  context: ActionContext,
) {
  const result = canPerform(agreement, milestone, action, context.actorRole);
  if (!result.allowed) {
    throw new Error(result.reason ?? "This action is not permitted.");
  }
}

export function PactRailProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoreState>(() => createDemoStore());
  const stateRef = useRef(state);
  const [hydrated, setHydrated] = useState(false);

  const commit = useCallback((updater: (current: StoreState) => StoreState) => {
    const next = updater(stateRef.current);
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as StoreState;
        if (parsed.version === 1 && Array.isArray(parsed.agreements)) {
          stateRef.current = parsed;
          setState(parsed);
        }
      }
    } catch {
      // Fall back to seeded demo data if stored state is unreadable.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage can be unavailable in private windows. The in-memory session still works.
    }
  }, [state, hydrated]);

  const setMode = useCallback(
    (mode: WorkspaceMode) => {
      commit((current) => ({ ...current, mode }));
    },
    [commit],
  );

  const setDemoActor = useCallback(
    (role: ActorRole) => {
      commit((current) => ({ ...current, demoActor: role }));
    },
    [commit],
  );

  const createAgreement = useCallback(
    (input: CreateAgreementInput & { txHash?: `0x${string}` }): Agreement => {
      const createdAt = nowIso();
      const agreement: Agreement = {
        id:
          input.mode === "live" && input.chain
            ? `chain_${input.chain.chainId}_${input.chain.onchainAgreementId}`
            : uid("agr"),
        mode: input.mode,
        sample: false,
        title: input.draft.title,
        summary: input.draft.summary,
        payer: input.draft.payer,
        payee: input.draft.payee,
        arbitrator: input.draft.arbitrator,
        token: input.draft.token,
        totalAmountBaseUnits: input.draft.totalAmountBaseUnits,
        jurisdictionContext: input.draft.jurisdictionContext,
        terms: input.terms,
        termsHash: input.termsHash,
        termsApprovedAt: createdAt,
        createdAt,
        updatedAt: createdAt,
        milestones: input.draft.milestones.map((milestone, index) => ({
          id: uid("ms"),
          index,
          description: milestone.description,
          acceptanceCriteria: milestone.acceptanceCriteria,
          amountBaseUnits: milestone.amountBaseUnits,
          dueAt: milestone.dueAt,
          status: "pending",
        })),
        chain: input.chain ?? null,
        sourceText: input.sourceSaved ? input.sourceText : undefined,
        sourceSaved: input.sourceSaved,
      };

      const context: ActionContext = {
        actorRole: "payer",
        actorName: "All parties",
        txHash: input.txHash,
        chainId: input.chain?.chainId,
      };
      const events: ActivityEvent[] = [
        makeEvent(
          agreement,
          "terms_confirmed",
          { ...context, txHash: undefined, actorName: "All parties" },
          "Parties reviewed and approved the structured terms and SHA-256 terms hash.",
          { origin: "offchain", hashRef: input.termsHash },
        ),
        makeEvent(
          agreement,
          "agreement_created",
          context,
          input.mode === "live"
            ? "Agreement created on-chain with the approved milestone schedule."
            : "Agreement created in the demo workspace.",
          { origin: input.mode === "live" ? "onchain" : "demo" },
        ),
      ];

      commit((current) => ({
        ...current,
        agreements: [agreement, ...current.agreements],
        activity: [...events, ...current.activity],
      }));
      return agreement;
    },
    [commit],
  );

  const fundAgreement = useCallback(
    (agreementId: string, context: ActionContext) => {
      commit((current) => {
        const agreement = current.agreements.find((item) => item.id === agreementId);
        if (!agreement) throw new Error("Agreement not found.");
        ensurePermission(agreement, undefined, "fund", context);
        const at = nowIso();
        const updated: Agreement = { ...agreement, fundedAt: at, updatedAt: at };
        return {
          ...current,
          agreements: current.agreements.map((item) =>
            item.id === agreementId ? updated : item,
          ),
          activity: [
            makeEvent(
              updated,
              "funded",
              context,
              `Funded the escrow with ${money(updated, updated.totalAmountBaseUnits)}.`,
            ),
            ...current.activity,
          ],
        };
      });
    },
    [commit],
  );

  const submitEvidence = useCallback(
    (agreementId: string, milestoneId: string, evidence: EvidenceRecord, context: ActionContext) => {
      commit((current) => {
        const agreement = current.agreements.find((item) => item.id === agreementId);
        if (!agreement) throw new Error("Agreement not found.");
        const milestone = agreement.milestones.find((item) => item.id === milestoneId);
        ensurePermission(agreement, milestone, "submit_evidence", context);
        const at = nowIso();
        const updatedMilestones = agreement.milestones.map((item) =>
          item.id === milestoneId
            ? { ...item, status: "submitted" as const, evidence, submittedAt: at }
            : item,
        );
        const updated: Agreement = {
          ...agreement,
          milestones: updatedMilestones,
          updatedAt: at,
        };
        return {
          ...current,
          agreements: current.agreements.map((item) =>
            item.id === agreementId ? updated : item,
          ),
          activity: [
            makeEvent(
              updated,
              "evidence_submitted",
              context,
              `Submitted evidence for ${milestone?.description ?? "milestone"}.`,
              { hashRef: evidence.hash, detail: evidence.description },
            ),
            ...current.activity,
          ],
        };
      });
    },
    [commit],
  );

  const approveMilestone = useCallback(
    (agreementId: string, milestoneId: string, context: ActionContext) => {
      commit((current) => {
        const agreement = current.agreements.find((item) => item.id === agreementId);
        if (!agreement) throw new Error("Agreement not found.");
        const milestone = agreement.milestones.find((item) => item.id === milestoneId);
        ensurePermission(agreement, milestone, "approve", context);
        if (!milestone) throw new Error("Milestone not found.");
        const at = nowIso();
        const updatedMilestones = agreement.milestones.map((item) =>
          item.id === milestoneId
            ? {
                ...item,
                status: "released" as const,
                releasedAmountBaseUnits: item.amountBaseUnits,
                resolvedAt: at,
              }
            : item,
        );
        let updated: Agreement = {
          ...agreement,
          milestones: updatedMilestones,
          updatedAt: at,
        };
        const events = [
          makeEvent(
            updated,
            "milestone_approved",
            context,
            `Approved ${milestone.description} and released ${money(
              updated,
              milestone.amountBaseUnits,
            )}.`,
          ),
        ];
        const completion = attachCompletion(updated, context);
        updated = completion.agreement;
        if (completion.event) events.push(completion.event);
        return {
          ...current,
          agreements: current.agreements.map((item) =>
            item.id === agreementId ? updated : item,
          ),
          activity: [...events, ...current.activity],
        };
      });
    },
    [commit],
  );

  const raiseDispute = useCallback(
    (agreementId: string, milestoneId: string, reason: string, context: ActionContext) => {
      commit((current) => {
        const agreement = current.agreements.find((item) => item.id === agreementId);
        if (!agreement) throw new Error("Agreement not found.");
        const milestone = agreement.milestones.find((item) => item.id === milestoneId);
        ensurePermission(agreement, milestone, "dispute", context);
        if (!milestone) throw new Error("Milestone not found.");
        const at = nowIso();
        const reasonHash = hashText(reason);
        const updatedMilestones = agreement.milestones.map((item) =>
          item.id === milestoneId
            ? {
                ...item,
                status: "disputed" as const,
                dispute: {
                  raisedByRole: context.actorRole,
                  raisedByLabel: context.actorName ?? actorLabel(agreement, context.actorRole),
                  reason,
                  reasonHash,
                  raisedAt: at,
                  status: "open" as const,
                },
              }
            : item,
        );
        const updated: Agreement = {
          ...agreement,
          milestones: updatedMilestones,
          updatedAt: at,
        };
        return {
          ...current,
          agreements: current.agreements.map((item) =>
            item.id === agreementId ? updated : item,
          ),
          activity: [
            makeEvent(
              updated,
              "dispute_raised",
              context,
              `Disputed ${milestone.description}. Funds remain locked until arbitrator resolution.`,
              { hashRef: reasonHash, detail: reason },
            ),
            ...current.activity,
          ],
        };
      });
    },
    [commit],
  );

  const resolveDispute = useCallback(
    (
      agreementId: string,
      milestoneId: string,
      payeeAmountBaseUnits: string,
      payerRefundBaseUnits: string,
      note: string,
      context: ActionContext,
    ) => {
      commit((current) => {
        const agreement = current.agreements.find((item) => item.id === agreementId);
        if (!agreement) throw new Error("Agreement not found.");
        const milestone = agreement.milestones.find((item) => item.id === milestoneId);
        ensurePermission(agreement, milestone, "resolve", context);
        if (!milestone) throw new Error("Milestone not found.");
        const payee = BigInt(payeeAmountBaseUnits);
        const refund = BigInt(payerRefundBaseUnits);
        if (payee < 0n || refund < 0n || payee + refund !== BigInt(milestone.amountBaseUnits)) {
          throw new Error("The split must equal the milestone amount.");
        }
        const at = nowIso();
        const status =
          refund === BigInt(milestone.amountBaseUnits)
            ? ("refunded" as const)
            : ("resolved" as const);
        const updatedMilestones = agreement.milestones.map((item) =>
          item.id === milestoneId
            ? {
                ...item,
                status,
                releasedAmountBaseUnits: payeeAmountBaseUnits,
                refundedAmountBaseUnits: payerRefundBaseUnits,
                resolvedAt: at,
                dispute: item.dispute
                  ? {
                      ...item.dispute,
                      status: "resolved" as const,
                      resolution: {
                        payeeAmountBaseUnits,
                        payerRefundAmountBaseUnits: payerRefundBaseUnits,
                        note,
                        resolvedAt: at,
                        arbitratorLabel:
                          context.actorName ?? actorLabel(agreement, context.actorRole),
                      },
                    }
                  : undefined,
              }
            : item,
        );
        let updated: Agreement = {
          ...agreement,
          milestones: updatedMilestones,
          updatedAt: at,
        };
        const events = [
          makeEvent(
            updated,
            "dispute_resolved",
            context,
            `Resolved ${milestone.description}: ${money(
              updated,
              payeeAmountBaseUnits,
            )} to payee, ${money(updated, payerRefundBaseUnits)} refunded to payer.`,
            { detail: note },
          ),
        ];
        if (refund > 0n) {
          events.push(
            makeEvent(
              updated,
              "refund_issued",
              context,
              `Refund of ${money(updated, payerRefundBaseUnits)} returned to the payer.`,
            ),
          );
        }
        const completion = attachCompletion(updated, context);
        updated = completion.agreement;
        if (completion.event) events.push(completion.event);
        return {
          ...current,
          agreements: current.agreements.map((item) =>
            item.id === agreementId ? updated : item,
          ),
          activity: [...events, ...current.activity],
        };
      });
    },
    [commit],
  );

  const recordEvidenceVerification = useCallback(
    (agreementId: string, milestoneId: string, matched: boolean, fileName?: string) => {
      commit((current) => {
        const agreement = current.agreements.find((item) => item.id === agreementId);
        if (!agreement) return current;
        const milestone = agreement.milestones.find((item) => item.id === milestoneId);
        if (!milestone) return current;
        const context: ActionContext = {
          actorRole: "payer",
          actorName: "Local verification",
        };
        return {
          ...current,
          activity: [
            makeEvent(
              agreement,
              "evidence_verified",
              { ...context, txHash: undefined },
              matched
                ? `Local SHA-256 check matched the submitted hash for ${milestone.description}.`
                : `Local SHA-256 check did not match the submitted hash for ${milestone.description}.`,
              {
                origin: "offchain",
                hashRef: milestone.evidence?.hash,
                detail: fileName,
              },
            ),
            ...current.activity,
          ],
        };
      });
    },
    [commit],
  );

  const resetDemoWorkspace = useCallback(() => {
    commit((current) => {
      const fresh = createDemoStore();
      return {
        ...current,
        demoActor: "payer",
        agreements: [
          ...current.agreements.filter((agreement) => agreement.mode === "live"),
          ...fresh.agreements,
        ],
        activity: [
          ...current.activity.filter((event) => event.mode === "live"),
          ...fresh.activity,
        ],
      };
    });
  }, [commit]);

  const clearAllLocalData = useCallback(() => {
    const fresh = createDemoStore();
    stateRef.current = fresh;
    setState(fresh);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage failures.
    }
  }, []);

  const value = useMemo<PactRailContextValue>(
    () => ({
      state,
      hydrated,
      setMode,
      setDemoActor,
      createAgreement,
      fundAgreement,
      submitEvidence,
      approveMilestone,
      raiseDispute,
      resolveDispute,
      recordEvidenceVerification,
      resetDemoWorkspace,
      clearAllLocalData,
    }),
    [
      state,
      hydrated,
      setMode,
      setDemoActor,
      createAgreement,
      fundAgreement,
      submitEvidence,
      approveMilestone,
      raiseDispute,
      resolveDispute,
      recordEvidenceVerification,
      resetDemoWorkspace,
      clearAllLocalData,
    ],
  );

  return <PactRailContext.Provider value={value}>{children}</PactRailContext.Provider>;
}

export function usePactRail(): PactRailContextValue {
  const context = useContext(PactRailContext);
  if (!context) throw new Error("usePactRail must be used inside PactRailProvider.");
  return context;
}

export function useWorkspaceAgreements(): Agreement[] {
  const { state } = usePactRail();
  return useMemo(
    () => state.agreements.filter((agreement) => agreement.mode === state.mode),
    [state.agreements, state.mode],
  );
}

export function useAgreement(id: string): Agreement | undefined {
  const { state } = usePactRail();
  return state.agreements.find((agreement) => agreement.id === id);
}

export function useWorkspaceActivity(): ActivityEvent[] {
  const { state } = usePactRail();
  return useMemo(
    () => state.activity.filter((event) => event.mode === state.mode),
    [state.activity, state.mode],
  );
}

export { STORAGE_KEY };
