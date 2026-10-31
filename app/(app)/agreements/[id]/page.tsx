"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { sha256, stringToBytes } from "viem";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Download,
  ExternalLink,
  FileText,
  Fingerprint,
  Flag,
  FlaskConical,
  Gavel,
  Info,
  Landmark,
  Loader2,
  RefreshCw,
  Scale,
  Upload,
  UserRound,
} from "lucide-react";
import {
  useAgreement,
  usePactRail,
} from "@/lib/store/pactrail-store";
import {
  mergeOnchainAgreement,
  useEscrowActions,
  useOnchainAgreement,
} from "@/lib/chain/hooks";
import {
  addressExplorerUrl,
  networkFor,
  txExplorerUrl,
} from "@/lib/chain/config";
import {
  actorLabel,
  canPerform,
  roleForAddress,
} from "@/lib/agreement/permissions";
import {
  deriveAgreementStatus,
  fundedEscrowBaseUnits,
  isTerminalMilestone,
  nextMilestone,
} from "@/lib/agreement/status";
import type {
  ActorRole,
  Agreement,
  EvidenceRecord,
  Milestone,
} from "@/lib/types";
import {
  cn,
  downloadTextFile,
  formatDate,
  formatDateTime,
  formatTokenAmount,
  formatUnitsInput,
  parseAmountToBaseUnits,
  shortAddress,
} from "@/lib/utils";
import { AgreementStatusBadge, Badge, DemoBadge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CopyButton,
  EmptyState,
  HashDisplay,
  ProgressBar,
} from "@/components/ui/primitives";
import { Field, FormNote, Input, Textarea } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { MilestoneCard } from "@/components/agreements/milestone-card";
import { ActivityTimeline } from "@/components/agreements/activity-timeline";
import { EvidenceDialog } from "@/components/evidence/evidence-dialog";
import { WalletButton } from "@/components/wallet/wallet-button";

type ActionDialog =
  | "fund"
  | "evidence"
  | "approve"
  | "dispute"
  | "resolve"
  | "view_evidence"
  | null;

function RoleStrip({
  role,
  setRole,
}: {
  role: ActorRole;
  setRole: (role: ActorRole) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-clay-200 bg-clay-50 px-3 py-2">
      <span className="flex items-center gap-1.5 text-[0.64rem] font-bold uppercase tracking-[0.1em] text-clay-800">
        <FlaskConical className="h-3.5 w-3.5" />
        Demo role
      </span>
      <div className="flex gap-1">
        {(["payer", "payee", "arbitrator"] as ActorRole[]).map((item) => (
          <button
            key={item}
            type="button"
            data-testid={`demo-role-${item}`}
            onClick={() => setRole(item)}
            className={cn(
              "rounded-lg px-2 py-1 text-[0.66rem] font-semibold capitalize transition-colors",
              role === item
                ? "bg-clay-700 text-white"
                : "text-clay-700 hover:bg-clay-100",
            )}
            aria-pressed={role === item}
          >
            {item}
          </button>
        ))}
      </div>
      <span className="text-[0.65rem] text-clay-700">
        Switch roles to exercise payer, payee, and arbitrator permissions.
      </span>
    </div>
  );
}

function PartyCard({ agreement, role }: { agreement: Agreement; role: ActorRole }) {
  const party = role === "payer" ? agreement.payer : role === "payee" ? agreement.payee : agreement.arbitrator;
  const initials = party.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  const explorer = addressExplorerUrl(agreement.chain?.chainId, party.address);
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-canvas text-[0.68rem] font-bold text-ink-mute">
        {initials || <UserRound className="h-3.5 w-3.5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[0.78rem] font-semibold text-ink">{party.name || "Not set"}</p>
          <span className="shrink-0 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-ink-faint">
            {role}
          </span>
        </div>
        {party.address ? (
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <code className="font-mono text-[0.64rem] text-ink-mute">
              {shortAddress(party.address, 6)}
            </code>
            <CopyButton value={party.address} label="" />
            {explorer ? (
              <a
                href={explorer}
                target="_blank"
                rel="noreferrer"
                className="text-ink-faint hover:text-forest-700"
                aria-label="View address on explorer"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        ) : (
          <p className="mt-0.5 text-[0.64rem] text-ink-faint">Demo identity · no wallet</p>
        )}
      </div>
    </div>
  );
}

export default function AgreementDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const local = useAgreement(id);
  const { state, setMode, setDemoActor, fundAgreement, submitEvidence, approveMilestone, raiseDispute, resolveDispute } =
    usePactRail();
  const onchain = useOnchainAgreement(local);
  const escrow = useEscrowActions();
  const { address } = useAccount();
  const walletChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { pushToast, updateToast } = useToast();

  const agreement = React.useMemo(
    () => (local ? mergeOnchainAgreement(local, onchain.data) : undefined),
    [local, onchain.data],
  );

  const [dialog, setDialog] = React.useState<ActionDialog>(null);
  const [dialogMilestone, setDialogMilestone] = React.useState<Milestone | null>(null);
  const [busyAction, setBusyAction] = React.useState<
    "fund" | "submit_evidence" | "approve" | "dispute" | "resolve" | null
  >(null);
  const [dialogError, setDialogError] = React.useState<string | null>(null);

  const [evidenceDescription, setEvidenceDescription] = React.useState("");
  const [evidenceUri, setEvidenceUri] = React.useState("");
  const [evidenceHash, setEvidenceHash] = React.useState("");
  const [evidenceFileName, setEvidenceFileName] = React.useState("");
  const [evidenceFileSize, setEvidenceFileSize] = React.useState<number | undefined>();
  const [evidenceMime, setEvidenceMime] = React.useState<string | undefined>();
  const [sampleArtifact, setSampleArtifact] = React.useState("");
  const [disputeReason, setDisputeReason] = React.useState("");
  const [resolveAmount, setResolveAmount] = React.useState("");
  const [resolveNote, setResolveNote] = React.useState("");

  const events = React.useMemo(
    () => state.activity.filter((event) => event.agreementId === id),
    [state.activity, id],
  );

  const modeMismatch = Boolean(local && local.mode !== state.mode);
  const role: ActorRole | null = agreement
    ? agreement.mode === "demo"
      ? state.demoActor
      : roleForAddress(agreement, address)
    : null;
  const demo = agreement?.mode === "demo";
  const network = networkFor(agreement?.chain?.chainId ?? walletChainId);
  const walletOnAgreementChain =
    !agreement?.chain || agreement.chain.chainId === walletChainId;
  const chainConfigured = Boolean(
    network?.escrowAddress && network?.tokenAddress,
  );

  const walletBlockedReason = !agreement
    ? null
    : agreement.mode === "demo"
      ? null
      : !address
        ? "Connect a wallet to take live actions."
        : !walletOnAgreementChain
          ? `Switch your wallet to ${network?.label ?? `chain ${agreement.chain?.chainId}`}.`
          : !role
            ? "The connected wallet is not the payer, payee, or arbitrator in this agreement."
            : !chainConfigured
              ? "The escrow contract is not configured in this build."
              : null;

  const status = agreement ? deriveAgreementStatus(agreement) : null;
  const escrowBalance = agreement ? fundedEscrowBaseUnits(agreement) : 0n;
  const milestone = agreement ? nextMilestone(agreement) : undefined;
  const progress = agreement
    ? Math.round(
        (agreement.milestones.filter((item) => isTerminalMilestone(item.status)).length /
          Math.max(agreement.milestones.length, 1)) *
          100,
      )
    : 0;
  const termsMismatch =
    Boolean(agreement && onchain.data) &&
    agreement!.termsHash.toLowerCase() !== onchain.data!.termsHash.toLowerCase();

  function openDialog(kind: ActionDialog, target?: Milestone) {
    setDialogError(null);
    setDialogMilestone(target ?? null);
    if (kind === "dispute") setDisputeReason("");
    if (kind === "resolve" && target) {
      setResolveAmount(formatUnitsInput(target.amountBaseUnits, agreement?.token.decimals ?? 6));
      setResolveNote("");
    }
    if (kind === "evidence" && target) {
      setEvidenceDescription("");
      setEvidenceUri("");
      setEvidenceHash("");
      setEvidenceFileName("");
      setEvidenceFileSize(undefined);
      setEvidenceMime(undefined);
      setSampleArtifact("");
    }
    setDialog(kind);
  }

  function context(actorRole: ActorRole, txHash?: `0x${string}`, blockNumber?: string, chainId?: number) {
    return {
      actorRole,
      actorName: agreement ? actorLabel(agreement, actorRole) : "Party",
      txHash,
      chainId,
      blockNumber,
    };
  }

  async function handleFund() {
    if (!agreement || !role) return;
    setBusyAction("fund");
    setDialogError(null);
    let toastId: string | undefined;
    try {
      if (agreement.mode === "demo") {
        fundAgreement(agreement.id, context(role));
        pushToast({
          title: "Demo escrow funded",
          description: "This is a local demo event. No tokens moved on-chain.",
          tone: "success",
        });
      } else {
        toastId = pushToast({
          title: "Confirm funding in your wallet",
          description: "A token approval may be requested before the escrow deposit.",
          tone: "pending",
          duration: 0,
        });
        const result = await escrow.fund(agreement);
        fundAgreement(
          agreement.id,
          context(role, result.txHash, result.blockNumber, agreement.chain?.chainId),
        );
        await onchain.refetch();
        const explorer = txExplorerUrl(agreement.chain?.chainId, result.txHash);
        updateToast(toastId, {
          title: "Escrow funded",
          description: result.approveHash
            ? "Token approval and funding both confirmed on-chain."
            : "Funding confirmed on-chain.",
          tone: "success",
          duration: 6000,
          action: explorer ? { label: "View transaction", href: explorer } : undefined,
        });
      }
      setDialog(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Funding failed.";
      setDialogError(message);
      if (toastId) {
        updateToast(toastId, { title: "Funding not completed", description: message, tone: "error" });
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function handleEvidenceSubmit() {
    if (!agreement || !dialogMilestone || !role) return;
    if (!/^[0-9a-fA-F]{64}$/.test(evidenceHash)) {
      setDialogError("Provide a 32-byte SHA-256 evidence hash.");
      return;
    }
    if (evidenceDescription.trim().length < 5) {
      setDialogError("Add a short evidence description.");
      return;
    }
    if (evidenceUri && !/^(https?:\/\/|ipfs:\/\/)/i.test(evidenceUri)) {
      setDialogError("Evidence links must start with http://, https://, or ipfs://.");
      return;
    }
    const record: EvidenceRecord = {
      description: evidenceDescription.trim(),
      uri: evidenceUri.trim() || undefined,
      fileName: evidenceFileName || undefined,
      fileSize: evidenceFileSize,
      mimeType: evidenceMime,
      hash: evidenceHash.toLowerCase(),
      submittedAt: new Date().toISOString(),
      submittedByRole: "payee",
      submittedByLabel: agreement.payee.name,
    };
    setBusyAction("submit_evidence");
    setDialogError(null);
    let toastId: string | undefined;
    try {
      if (agreement.mode === "demo") {
        submitEvidence(agreement.id, dialogMilestone.id, record, context(role));
        pushToast({
          title: "Evidence recorded",
          description: "Demo evidence and its SHA-256 hash were added to the milestone.",
          tone: "success",
        });
      } else {
        toastId = pushToast({
          title: "Confirm evidence submission",
          description: "Only the evidence hash and short reference will be written on-chain.",
          tone: "pending",
          duration: 0,
        });
        const result = await escrow.submitEvidence(agreement, dialogMilestone, record);
        submitEvidence(
          agreement.id,
          dialogMilestone.id,
          record,
          context(role, result.txHash, result.blockNumber, agreement.chain?.chainId),
        );
        await onchain.refetch();
        const explorer = txExplorerUrl(agreement.chain?.chainId, result.txHash);
        updateToast(toastId, {
          title: "Evidence submitted on-chain",
          description: "The milestone now awaits payer review.",
          tone: "success",
          duration: 6000,
          action: explorer ? { label: "View transaction", href: explorer } : undefined,
        });
      }
      setDialog(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Evidence submission failed.";
      setDialogError(message);
      if (toastId) {
        updateToast(toastId, { title: "Evidence not submitted", description: message, tone: "error" });
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function handleApprove() {
    if (!agreement || !dialogMilestone || !role) return;
    setBusyAction("approve");
    setDialogError(null);
    let toastId: string | undefined;
    try {
      if (agreement.mode === "demo") {
        approveMilestone(agreement.id, dialogMilestone.id, context(role));
        pushToast({
          title: "Milestone released",
          description: `Demo release of ${formatTokenAmount(
            dialogMilestone.amountBaseUnits,
            agreement.token.decimals,
          )} ${agreement.token.symbol}.`,
          tone: "success",
        });
      } else {
        toastId = pushToast({
          title: "Confirm release in your wallet",
          description: "Approving transfers exactly the milestone amount to the payee.",
          tone: "pending",
          duration: 0,
        });
        const result = await escrow.approve(agreement, dialogMilestone);
        approveMilestone(
          agreement.id,
          dialogMilestone.id,
          context(role, result.txHash, result.blockNumber, agreement.chain?.chainId),
        );
        await onchain.refetch();
        const explorer = txExplorerUrl(agreement.chain?.chainId, result.txHash);
        updateToast(toastId, {
          title: "Milestone released",
          description: `${formatTokenAmount(
            dialogMilestone.amountBaseUnits,
            agreement.token.decimals,
          )} ${agreement.token.symbol} transferred to the payee.`,
          tone: "success",
          duration: 6000,
          action: explorer ? { label: "View transaction", href: explorer } : undefined,
        });
      }
      setDialog(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Release failed.";
      setDialogError(message);
      if (toastId) {
        updateToast(toastId, { title: "Release not completed", description: message, tone: "error" });
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDispute() {
    if (!agreement || !dialogMilestone || !role) return;
    if (disputeReason.trim().length < 12) {
      setDialogError("Describe the issue in at least 12 characters.");
      return;
    }
    setBusyAction("dispute");
    setDialogError(null);
    let toastId: string | undefined;
    try {
      if (agreement.mode === "demo") {
        raiseDispute(agreement.id, dialogMilestone.id, disputeReason.trim(), context(role));
        pushToast({
          title: "Dispute opened",
          description: "The milestone is locked until the arbitrator resolves it.",
          tone: "warning",
        });
      } else {
        toastId = pushToast({
          title: "Confirm dispute in your wallet",
          description: "Only a hash of the dispute reason is written on-chain.",
          tone: "pending",
          duration: 0,
        });
        const result = await escrow.dispute(agreement, dialogMilestone, disputeReason.trim());
        raiseDispute(
          agreement.id,
          dialogMilestone.id,
          disputeReason.trim(),
          context(role, result.txHash, result.blockNumber, agreement.chain?.chainId),
        );
        await onchain.refetch();
        const explorer = txExplorerUrl(agreement.chain?.chainId, result.txHash);
        updateToast(toastId, {
          title: "Dispute opened on-chain",
          description: "Ordinary release is blocked for this milestone.",
          tone: "warning",
          duration: 6000,
          action: explorer ? { label: "View transaction", href: explorer } : undefined,
        });
      }
      setDialog(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Dispute failed.";
      setDialogError(message);
      if (toastId) {
        updateToast(toastId, { title: "Dispute not opened", description: message, tone: "error" });
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function handleResolve() {
    if (!agreement || !dialogMilestone || !role) return;
    const amount = BigInt(dialogMilestone.amountBaseUnits);
    const parsed = parseAmountToBaseUnits(resolveAmount, agreement.token.decimals);
    if (!parsed.ok) {
      setDialogError(parsed.error);
      return;
    }
    const payeeAmount = BigInt(parsed.value);
    if (payeeAmount > amount) {
      setDialogError("The payee award cannot exceed the milestone amount.");
      return;
    }
    if (resolveNote.trim().length < 5) {
      setDialogError("Add a short resolution note.");
      return;
    }
    const refund = amount - payeeAmount;
    setBusyAction("resolve");
    setDialogError(null);
    let toastId: string | undefined;
    try {
      if (agreement.mode === "demo") {
        resolveDispute(
          agreement.id,
          dialogMilestone.id,
          payeeAmount.toString(),
          refund.toString(),
          resolveNote.trim(),
          context(role),
        );
        pushToast({
          title: "Dispute resolved",
          description: "Demo split recorded. The milestone is settled.",
          tone: "success",
        });
      } else {
        toastId = pushToast({
          title: "Confirm resolution in your wallet",
          description: "Transfers use the exact split entered by the arbitrator.",
          tone: "pending",
          duration: 0,
        });
        const result = await escrow.resolve(
          agreement,
          dialogMilestone,
          payeeAmount.toString(),
          refund.toString(),
        );
        resolveDispute(
          agreement.id,
          dialogMilestone.id,
          payeeAmount.toString(),
          refund.toString(),
          resolveNote.trim(),
          context(role, result.txHash, result.blockNumber, agreement.chain?.chainId),
        );
        await onchain.refetch();
        const explorer = txExplorerUrl(agreement.chain?.chainId, result.txHash);
        updateToast(toastId, {
          title: "Dispute resolved on-chain",
          description: `${formatTokenAmount(
            payeeAmount.toString(),
            agreement.token.decimals,
          )} to payee · ${formatTokenAmount(
            refund.toString(),
            agreement.token.decimals,
          )} refunded.`,
          tone: "success",
          duration: 6000,
          action: explorer ? { label: "View transaction", href: explorer } : undefined,
        });
      }
      setDialog(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Resolution failed.";
      setDialogError(message);
      if (toastId) {
        updateToast(toastId, { title: "Resolution not completed", description: message, tone: "error" });
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function loadSampleEvidence() {
    if (!agreement || !dialogMilestone) return;
    const content = `PactRail demo evidence artifact
Agreement: ${agreement.title} (${agreement.id})
Milestone: ${dialogMilestone.description}
Submitted by: ${agreement.payee.name}
Statement: The milestone deliverable is available for demo review. This artifact is generated locally and contains no confidential information.`;
    const hash = sha256(stringToBytes(content)).slice(2);
    setEvidenceDescription(
      "Demo delivery note generated from a known local artifact. Verify the hash by downloading or recreating the artifact.",
    );
    setEvidenceHash(hash);
    setEvidenceFileName("demo-delivery-note.txt");
    setEvidenceFileSize(new TextEncoder().encode(content).length);
    setEvidenceMime("text/plain");
    setSampleArtifact(content);
    setDialogError(null);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", buffer);
      const hash = Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      setEvidenceHash(hash);
      setEvidenceFileName(file.name);
      setEvidenceFileSize(file.size);
      setEvidenceMime(file.type || "application/octet-stream");
      setSampleArtifact("");
      setDialogError(null);
    } catch {
      setDialogError("The file could not be read by this browser.");
    }
  }

  if (!local) {
    return (
      <div className="space-y-5">
        <Link href="/agreements" className="inline-flex items-center gap-1.5 text-[0.72rem] font-semibold text-ink-mute hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Agreements
        </Link>
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title="Agreement not found in this workspace"
          description="The record may have been cleared from local storage, or it belongs to a different browser. Live on-chain agreements remain on the chain, but their off-chain metadata is stored locally in this prototype."
          action={
            <Link href="/agreements" className={buttonStyles()}>
              Back to agreements
            </Link>
          }
        />
      </div>
    );
  }

  if (!agreement || !status) return null;

  if (modeMismatch) {
    return (
      <div className="space-y-5">
        <Link href="/agreements" className="inline-flex items-center gap-1.5 text-[0.72rem] font-semibold text-ink-mute hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Agreements
        </Link>
        <EmptyState
          icon={<FlaskConical className="h-5 w-5" />}
          title={`This record belongs to the ${local.mode} workspace`}
          description="Demo and live records are kept separate so simulated activity is never mixed with testnet transactions. Switch workspace explicitly to open it."
          action={
            <Button onClick={() => setMode(local.mode)}>
              Switch to {local.mode} workspace
            </Button>
          }
        />
      </div>
    );
  }

  const contractExplorer = addressExplorerUrl(
    agreement.chain?.chainId,
    agreement.chain?.contractAddress,
  );
  const termsExplorer = txExplorerUrl(
    agreement.chain?.chainId,
    agreement.chain?.createdAtTxHash,
  );

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/agreements"
          className="inline-flex items-center gap-1.5 text-[0.72rem] font-semibold text-ink-mute hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Agreements
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {demo ? <DemoBadge label="Sample demo record" /> : <Badge tone="blue">Live testnet record</Badge>}
          {agreement.chain ? (
            <Badge tone="neutral">{network?.label ?? `Chain ${agreement.chain.chainId}`}</Badge>
          ) : null}
          {onchain.isLoading ? (
            <Badge tone="outline">
              <Loader2 className="h-3 w-3 animate-spin" />
              Syncing chain
            </Badge>
          ) : null}
          <Link href="/audit" className={buttonStyles({ variant: "ghost", size: "sm" })}>
            Audit trail <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_0.9fr]">
        <div className="min-w-0 space-y-5">
          <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <AgreementStatusBadge status={status} />
                  <span className="text-[0.64rem] font-semibold uppercase tracking-[0.1em] text-ink-faint">
                    {agreement.milestones.length} milestones · created {formatDate(agreement.createdAt)}
                  </span>
                </div>
                <h1 className="mt-3 text-[1.95rem] leading-[1.12] text-ink sm:text-[2.35rem]">
                  {agreement.title}
                </h1>
                <p className="mt-2 max-w-xl text-[0.82rem] leading-relaxed text-ink-mute">
                  {agreement.summary}
                </p>
              </div>
              <div className="shrink-0 sm:text-right">
                <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-ink-faint">
                  Agreement value
                </p>
                <p className="tabular mt-1 font-serif text-[2rem] leading-none text-ink">
                  {formatTokenAmount(agreement.totalAmountBaseUnits, agreement.token.decimals)}
                </p>
                <p className="mt-1 text-[0.66rem] font-medium text-ink-faint">
                  {agreement.token.symbol} · {demo ? "test units, simulated" : "testnet token"}
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3 border-t border-line pt-4">
              <ProgressBar value={progress} className="flex-1" />
              <span className="text-[0.64rem] font-semibold text-ink-mute">{progress}% settled</span>
            </div>

            {demo ? (
              <div className="mt-4">
                <RoleStrip role={state.demoActor} setRole={setDemoActor} />
              </div>
            ) : role ? (
              <div className="mt-4 flex items-center gap-1.5 text-[0.68rem] text-ink-mute">
                <UserRound className="h-3.5 w-3.5" />
                Acting as <span className="font-semibold text-ink">{actorLabel(agreement, role)}</span>
                <span className="capitalize text-ink-faint">({role})</span>
              </div>
            ) : null}

            {!demo && !walletOnAgreementChain ? (
              <div className="mt-4 flex flex-col gap-2 rounded-xl border border-danger-200 bg-danger-50 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[0.7rem] text-danger-800">
                  Wallet is on chain {walletChainId}. This agreement is on {network?.label ?? agreement.chain?.chainId}.
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    if (!agreement.chain) return;
                    try {
                      await switchChainAsync({ chainId: agreement.chain.chainId });
                      pushToast({ title: `Switched to ${network?.label ?? "network"}`, tone: "success" });
                    } catch (error) {
                      pushToast({
                        title: "Network switch was not completed",
                        description: error instanceof Error ? error.message.split("\n")[0] : undefined,
                        tone: "error",
                      });
                    }
                  }}
                >
                  Switch network
                </Button>
              </div>
            ) : null}
            {!demo && !address ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-canvas/50 px-3.5 py-2.5">
                <p className="text-[0.7rem] text-ink-mute">
                  Connect the wallet assigned to your role to act on this agreement.
                </p>
                <WalletButton compact />
              </div>
            ) : null}
            {!demo && address && !role ? (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-clay-200 bg-clay-50 px-3.5 py-2.5 text-[0.7rem] text-clay-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                This wallet is not a party to the agreement. You can inspect every record, but
                settlement actions are disabled.
              </div>
            ) : null}
            {onchain.error ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-danger-200 bg-danger-50 px-3.5 py-2.5 text-[0.7rem] text-danger-800">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  On-chain state could not be refreshed. Local metadata is shown.
                </span>
                <Button size="sm" variant="secondary" onClick={() => void onchain.refetch()}>
                  <RefreshCw className="h-3.5 w-3.5" /> Retry
                </Button>
              </div>
            ) : null}
            {termsMismatch ? (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-danger-200 bg-danger-50 px-3.5 py-2.5 text-[0.7rem] text-danger-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                The on-chain terms hash differs from the locally stored approved terms. Do not act
                until this is investigated.
              </div>
            ) : null}
          </div>

          <Card>
            <CardHeader
              title="Escrow"
              description={
                demo
                  ? "Simulated escrow for the demo workspace. No blockchain state is affected."
                  : "Token balances and milestone state are read directly from the escrow contract."
              }
              action={
                agreement.fundedAt ? (
                  <Badge tone="green" dot>
                    Funded
                  </Badge>
                ) : (
                  <Badge tone="amber" dot>
                    Not funded
                  </Badge>
                )
              }
            />
            <div className="p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-ink-faint">
                    Held in escrow
                  </p>
                  <p className="tabular mt-1 font-serif text-[1.45rem] text-ink">
                    {formatTokenAmount(escrowBalance, agreement.token.decimals)}
                  </p>
                  <p className="mt-0.5 text-[0.62rem] text-ink-faint">
                    {agreement.token.symbol} unsettled
                  </p>
                </div>
                <div>
                  <p className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-ink-faint">
                    Payer
                  </p>
                  <p className="mt-1 truncate text-[0.8rem] font-semibold text-ink">{agreement.payer.name}</p>
                  <p className="mt-0.5 font-mono text-[0.62rem] text-ink-mute">
                    {agreement.payer.address ? shortAddress(agreement.payer.address, 6) : "Demo identity"}
                  </p>
                </div>
                <div>
                  <p className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-ink-faint">
                    Next deadline
                  </p>
                  <p className="mt-1 text-[0.8rem] font-semibold text-ink">
                    {milestone ? formatDate(milestone.dueAt) : "All settled"}
                  </p>
                  <p className="mt-0.5 truncate text-[0.62rem] text-ink-mute">
                    {milestone?.description ?? "No open milestone"}
                  </p>
                </div>
              </div>

              {!agreement.fundedAt ? (
                <div className="mt-5 flex flex-col gap-3 rounded-xl border border-clay-200 bg-clay-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[0.76rem] font-semibold text-clay-900">
                      The escrow is waiting for the payer
                    </p>
                    <p className="mt-1 max-w-2xl text-[0.7rem] leading-relaxed text-clay-800">
                      Funding deposits the full agreement amount. Nothing is released automatically;
                      each milestone still requires payer approval or arbitrator resolution.
                    </p>
                    {(() => {
                      const permission = canPerform(agreement, undefined, "fund", role);
                      const blocked = !permission.allowed ? permission.reason : walletBlockedReason;
                      return blocked ? (
                        <p className="mt-1.5 text-[0.66rem] font-medium text-clay-700">{blocked}</p>
                      ) : null;
                    })()}
                  </div>
                  {(() => {
                    const permission = canPerform(agreement, undefined, "fund", role);
                    const blocked = !permission.allowed ? permission.reason : walletBlockedReason;
                    return (
                      <Button
                        onClick={() => openDialog("fund")}
                        disabled={Boolean(blocked)}
                        title={blocked ?? undefined}
                        loading={busyAction === "fund"}
                      >
                        <CircleDollarSign className="h-4 w-4" />
                        Fund escrow
                      </Button>
                    );
                  })()}
                </div>
              ) : (
                <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-line bg-canvas/40 px-4 py-3 text-[0.68rem] text-ink-mute">
                  <span>
                    Funded {formatDateTime(agreement.fundedAt)}
                  </span>
                  <span className="hidden h-3 w-px bg-line sm:block" />
                  <span>
                    Released{" "}
                    {formatTokenAmount(
                      agreement.milestones.reduce(
                        (sum, item) =>
                          sum +
                          (item.status === "released" || item.status === "resolved"
                            ? BigInt(item.releasedAmountBaseUnits ?? "0")
                            : 0n),
                        0n,
                      ),
                      agreement.token.decimals,
                    )}
                  </span>
                  <span className="hidden h-3 w-px bg-line sm:block" />
                  <span>
                    Refunded{" "}
                    {formatTokenAmount(
                      agreement.milestones.reduce(
                        (sum, item) =>
                          sum +
                          (item.status === "refunded" || item.status === "resolved"
                            ? BigInt(item.refundedAmountBaseUnits ?? "0")
                            : 0n),
                        0n,
                      ),
                      agreement.token.decimals,
                    )}
                  </span>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Milestones"
              description="Evidence is bound by hash. Release requires the payer; disputes require the arbitrator."
              action={<span className="text-[0.66rem] text-ink-faint">{progress}% complete</span>}
            />
            <div className="space-y-7 px-5 py-6 sm:px-6">
              {agreement.milestones.map((item, index) => (
                <div key={item.id} className="relative">
                  {index < agreement.milestones.length - 1 ? (
                    <span
                      className="absolute left-4 top-9 h-[calc(100%+1.75rem-2.25rem)] w-px bg-line sm:left-[1.125rem]"
                      aria-hidden
                    />
                  ) : null}
                  <MilestoneCard
                    agreement={agreement}
                    milestone={item}
                    role={role}
                    walletBlockedReason={walletBlockedReason}
                    busyAction={busyAction}
                    onOpenEvidence={(target) => openDialog("view_evidence", target)}
                    onSubmitEvidence={(target) => openDialog("evidence", target)}
                    onApprove={(target) => openDialog("approve", target)}
                    onDispute={(target) => openDialog("dispute", target)}
                    onResolve={(target) => openDialog("resolve", target)}
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Activity timeline"
              description="Off-chain records, demo events, and confirmed testnet transactions are labelled separately."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    downloadTextFile(
                      `${agreement.id}-activity.json`,
                      JSON.stringify(events, null, 2),
                      "application/json",
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" />
                  Export
                </Button>
              }
            />
            <ActivityTimeline events={events} />
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader title="Parties" description="Roles are fixed when the agreement is created." />
            <div className="divide-y divide-line px-5">
              <PartyCard agreement={agreement} role="payer" />
              <PartyCard agreement={agreement} role="payee" />
              <PartyCard agreement={agreement} role="arbitrator" />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Approved terms"
              description="The terms hash is committed when the agreement is created."
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    downloadTextFile(
                      `${agreement.id}-terms.json`,
                      JSON.stringify(
                        { ...agreement.terms, approvedAt: agreement.termsApprovedAt },
                        null,
                        2,
                      ),
                      "application/json",
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" />
                  JSON
                </Button>
              }
            />
            <div className="space-y-4 px-5 py-4 text-[0.7rem]">
              <div>
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-ink-faint">
                  SHA-256 terms hash
                </p>
                <HashDisplay hash={agreement.termsHash} truncate className="mt-1" />
                <p className="mt-1 text-[0.62rem] text-ink-faint">
                  Approved {formatDateTime(agreement.termsApprovedAt)}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-line pt-3">
                <div>
                  <dt className="text-ink-faint">Token</dt>
                  <dd className="mt-0.5 font-semibold text-ink">{agreement.token.symbol}</dd>
                </div>
                <div>
                  <dt className="text-ink-faint">Decimals</dt>
                  <dd className="mt-0.5 font-semibold text-ink">{agreement.token.decimals}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-ink-faint">Jurisdiction / context</dt>
                  <dd className="mt-0.5 text-ink-soft">
                    {agreement.jurisdictionContext || "Not provided"}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-ink-faint">{demo ? "Demo token" : "Token contract"}</dt>
                  <dd className="mt-0.5 break-all font-mono text-[0.62rem] text-ink-soft">
                    {agreement.token.address ?? "No on-chain token in demo mode"}
                  </dd>
                </div>
              </dl>
              {agreement.chain ? (
                <div className="border-t border-line pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-ink-faint">
                      Escrow contract
                    </p>
                    {contractExplorer ? (
                      <a
                        href={contractExplorer}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[0.62rem] font-semibold text-forest-700"
                      >
                        Explorer <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <code className="break-all font-mono text-[0.62rem] text-ink-soft">
                      {agreement.chain.contractAddress}
                    </code>
                    <CopyButton value={agreement.chain.contractAddress} label="" />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[0.64rem]">
                    <span className="text-ink-faint">On-chain ID</span>
                    <span className="tabular font-semibold text-ink">
                      #{agreement.chain.onchainAgreementId}
                    </span>
                  </div>
                  {agreement.chain.createdAtTxHash ? (
                    <div className="mt-2">
                      <HashDisplay
                        hash={agreement.chain.createdAtTxHash}
                        label="Creation tx"
                        href={termsExplorer}
                        truncate
                      />
                    </div>
                  ) : null}
                  {onchain.data ? (
                    <div className="mt-2 flex items-center justify-between gap-2 text-[0.64rem]">
                      <span className="text-ink-faint">Contract state</span>
                      <Badge tone={onchain.data.status === 3 ? "green" : "blue"}>
                        {onchain.data.status === 3
                          ? "Completed"
                          : onchain.data.status === 2
                            ? "Funded"
                            : "Created"}
                      </Badge>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Record details"
              description="Prototype boundaries, stated plainly."
            />
            <div className="space-y-3 px-5 py-4 text-[0.68rem] leading-relaxed text-ink-mute">
              <div className="flex items-start gap-2">
                <Fingerprint className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
                Hashes help verify that bytes match an earlier artifact. They do not establish that
                a document is true or legally sufficient.
              </div>
              <div className="flex items-start gap-2">
                <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
                {demo
                  ? "This record is seeded demo data or a locally simulated action. There is no corresponding blockchain transaction."
                  : "This record references a real testnet transaction. PactRail does not move mainnet funds."}
              </div>
              <div className="flex items-start gap-2">
                <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
                PactRail is not a source of legal advice, identity verification, or regulatory
                approval.
              </div>
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
                Agreement metadata is stored in this browser for the prototype. Only the terms hash,
                milestones, evidence hashes, and settlement state are on-chain.
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Dialog
        open={dialog === "fund"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Fund the escrow"
        description="The payer deposits the full agreement amount. Funds remain locked per milestone."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)} disabled={busyAction === "fund"}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleFund()}
              loading={busyAction === "fund"}
              loadingText="Confirming"
              data-testid="confirm-fund"
            >
              <Landmark className="h-4 w-4" />
              {demo ? "Fund demo escrow" : "Fund with wallet"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-canvas/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[0.72rem] text-ink-mute">Deposit amount</span>
              <span className="tabular font-serif text-[1.5rem] text-ink">
                {formatTokenAmount(agreement.totalAmountBaseUnits, agreement.token.decimals)}{" "}
                <span className="text-[0.68rem] font-sans font-medium text-ink-faint">
                  {agreement.token.symbol}
                </span>
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-line pt-2 text-[0.68rem]">
              <span className="text-ink-faint">Payer</span>
              <span className="font-semibold text-ink">{agreement.payer.name}</span>
            </div>
          </div>
          {demo ? (
            <FormNote>
              Demo action only. No token approval, token transfer, or blockchain transaction is
              created.
            </FormNote>
          ) : (
            <FormNote>
              Your wallet may request a token approval followed by the funding transaction. Both
              must confirm. Funding is recorded exactly once by the contract.
            </FormNote>
          )}
          {dialogError ? <FormNote tone="danger">{dialogError}</FormNote> : null}
        </div>
      </Dialog>

      <Dialog
        open={dialog === "evidence" && Boolean(dialogMilestone)}
        onOpenChange={(open) => !open && setDialog(null)}
        title={`Submit evidence — ${dialogMilestone?.description ?? ""}`}
        description="Only the SHA-256 hash and a short reference are recorded. Files are not uploaded."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)} disabled={busyAction === "submit_evidence"}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleEvidenceSubmit()}
              loading={busyAction === "submit_evidence"}
              loadingText="Submitting"
              disabled={!evidenceHash || evidenceDescription.trim().length < 5}
              data-testid="confirm-evidence"
            >
              <Upload className="h-4 w-4" />
              {demo ? "Record demo evidence" : "Submit evidence on-chain"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Evidence description" required>
            <Textarea
              value={evidenceDescription}
              onChange={(event) => setEvidenceDescription(event.target.value)}
              placeholder="Describe the deliverable and where a reviewer can find it."
              className="min-h-[84px]"
              data-testid="evidence-description"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
            <Field label="Evidence URL / reference" hint="Optional">
              <Input
                value={evidenceUri}
                onChange={(event) => setEvidenceUri(event.target.value)}
                placeholder="https://… or ipfs://…"
              />
            </Field>
            <Field label="SHA-256 hash" required hint="32 bytes">
              <Input
                value={evidenceHash}
                onChange={(event) => setEvidenceHash(event.target.value.replace(/^0x/, ""))}
                placeholder="64 hexadecimal characters"
                className="font-mono text-[0.7rem]"
                data-testid="evidence-hash"
              />
            </Field>
          </div>

          <div className="rounded-xl border border-dashed border-line-strong bg-canvas/40 px-4 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[0.76rem] font-semibold text-ink">Hash a local file</p>
                <p className="mt-0.5 text-[0.66rem] leading-relaxed text-ink-mute">
                  The file stays in your browser. Only its digest is used.
                </p>
                {evidenceFileName ? (
                  <p className="mt-1.5 text-[0.66rem] text-ink-soft">
                    {evidenceFileName} · {(evidenceFileSize ?? 0).toLocaleString()} bytes ·{" "}
                    {evidenceMime ?? "file"}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <label className={buttonStyles({ variant: "secondary", size: "sm", className: "cursor-pointer" })}>
                  <Upload className="h-3.5 w-3.5" />
                  Choose file
                  <input
                    type="file"
                    className="sr-only"
                    onChange={(event) => void handleFile(event.target.files?.[0])}
                  />
                </label>
                {demo ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => void loadSampleEvidence()}>
                    Use demo artifact
                  </Button>
                ) : null}
              </div>
            </div>
            {sampleArtifact ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-[0.66rem] font-semibold text-forest-700">
                  Inspect demo artifact
                </summary>
                <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-line bg-raised p-2.5 text-[0.62rem] leading-relaxed text-ink-mute scrollbar-thin">
                  {sampleArtifact}
                </pre>
              </details>
            ) : null}
          </div>
          <FormNote>
            A hash lets a reviewer confirm that bytes match the submitted artifact. It does not prove
            the artifact is truthful or complete.
          </FormNote>
          {dialogError ? <FormNote tone="danger">{dialogError}</FormNote> : null}
        </div>
      </Dialog>

      <Dialog
        open={dialog === "approve" && Boolean(dialogMilestone)}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Approve and release"
        description="This transfers exactly the milestone amount to the payee."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)} disabled={busyAction === "approve"}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleApprove()}
              loading={busyAction === "approve"}
              loadingText="Releasing"
              data-testid="confirm-approve"
            >
              <CheckCircle2 className="h-4 w-4" />
              {demo ? "Release demo funds" : "Approve with wallet"}
            </Button>
          </>
        }
      >
        {dialogMilestone ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-line bg-canvas/40 p-4">
              <p className="text-[0.72rem] font-semibold text-ink">{dialogMilestone.description}</p>
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                <span className="text-[0.7rem] text-ink-mute">Release to {agreement.payee.name}</span>
                <span className="tabular font-serif text-[1.4rem] text-ink">
                  {formatTokenAmount(dialogMilestone.amountBaseUnits, agreement.token.decimals)}{" "}
                  <span className="text-[0.66rem] font-sans font-medium text-ink-faint">
                    {agreement.token.symbol}
                  </span>
                </span>
              </div>
            </div>
            {dialogMilestone.evidence ? (
              <div className="rounded-lg border border-line bg-raised p-3">
                <HashDisplay hash={dialogMilestone.evidence.hash} label="Evidence hash" truncate />
              </div>
            ) : null}
            <FormNote>
              Approval is final for this milestone. After transfer, the milestone becomes terminal
              and cannot be disputed or released again.
            </FormNote>
            {dialogError ? <FormNote tone="danger">{dialogError}</FormNote> : null}
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={dialog === "dispute" && Boolean(dialogMilestone)}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Raise a dispute"
        description="The milestone freezes. Only the named arbitrator can release or refund it."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)} disabled={busyAction === "dispute"}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => void handleDispute()}
              loading={busyAction === "dispute"}
              loadingText="Opening"
              disabled={disputeReason.trim().length < 12}
              data-testid="confirm-dispute"
            >
              <Flag className="h-4 w-4" />
              {demo ? "Open demo dispute" : "Open dispute on-chain"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field
            label="Reason"
            required
            hint="Stored as a hash on-chain"
            description="The full reason is kept with this local record. Only the reason hash and your role are written to the escrow."
          >
            <Textarea
              value={disputeReason}
              onChange={(event) => setDisputeReason(event.target.value)}
              placeholder="Describe what is missing or disputed, with reference to the acceptance criteria."
              className="min-h-[110px]"
              data-testid="dispute-reason"
            />
          </Field>
          {disputeReason.trim() ? (
            <div className="rounded-lg border border-line bg-canvas/40 px-3 py-2">
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-ink-faint">
                Reason hash preview
              </p>
              <code className="hash mt-1 block break-all text-ink-soft">
                {sha256(stringToBytes(disputeReason.trim()))}
              </code>
            </div>
          ) : null}
          <div className="flex items-start gap-2 rounded-xl border border-clay-200 bg-clay-50 px-3.5 py-2.5 text-[0.68rem] leading-relaxed text-clay-800">
            <Gavel className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {agreement.arbitrator.name} is the named arbitrator for this agreement. PactRail does
            not decide disputes; the contract only enforces the split chosen by the arbitrator.
          </div>
          {dialogError ? <FormNote tone="danger">{dialogError}</FormNote> : null}
        </div>
      </Dialog>

      <Dialog
        open={dialog === "resolve" && Boolean(dialogMilestone)}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Resolve disputed milestone"
        description="The split must equal the milestone amount exactly."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)} disabled={busyAction === "resolve"}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => void handleResolve()}
              loading={busyAction === "resolve"}
              loadingText="Resolving"
              data-testid="confirm-resolve"
            >
              <Gavel className="h-4 w-4" />
              {demo ? "Record demo resolution" : "Resolve with wallet"}
            </Button>
          </>
        }
      >
        {dialogMilestone && role === "arbitrator" ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-line bg-canvas/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[0.7rem] text-ink-mute">Disputed amount</span>
                <span className="tabular font-serif text-[1.35rem] text-ink">
                  {formatTokenAmount(dialogMilestone.amountBaseUnits, agreement.token.decimals)}{" "}
                  {agreement.token.symbol}
                </span>
              </div>
              <p className="mt-2 text-[0.68rem] leading-relaxed text-ink-mute">
                {dialogMilestone.dispute?.reason}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Payee award" required hint={`Max ${formatUnitsInput(dialogMilestone.amountBaseUnits, agreement.token.decimals)}`}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[0.78rem] font-semibold text-ink-faint">
                    $
                  </span>
                  <Input
                    value={resolveAmount}
                    onChange={(event) => setResolveAmount(event.target.value)}
                    inputMode="decimal"
                    className="pl-6 font-mono"
                    data-testid="resolve-payee-amount"
                  />
                </div>
              </Field>
              <Field label="Payer refund" hint="Calculated">
                <Input
                  value={(() => {
                    const parsed = parseAmountToBaseUnits(resolveAmount, agreement.token.decimals);
                    if (!parsed.ok) return "—";
                    const amount = BigInt(dialogMilestone.amountBaseUnits);
                    const payee = BigInt(parsed.value);
                    if (payee > amount) return "Invalid";
                    return formatUnitsInput((amount - payee).toString(), agreement.token.decimals);
                  })()}
                  readOnly
                  className="bg-canvas/60 font-mono"
                  data-testid="resolve-refund-amount"
                />
              </Field>
            </div>
            <Field label="Resolution note" required>
              <Textarea
                value={resolveNote}
                onChange={(event) => setResolveNote(event.target.value)}
                placeholder="Explain the basis for the split. Kept off-chain; the split itself is on-chain."
                className="min-h-[76px]"
              />
            </Field>
            <FormNote>
              The arbitrator alone signs this action. A zero payee award is a full refund; a full
              payee award releases the full milestone.
            </FormNote>
            {dialogError ? <FormNote tone="danger">{dialogError}</FormNote> : null}
          </div>
        ) : (
          <FormNote tone="warning">
            Switch to the arbitrator role or connect the arbitrator wallet to resolve this dispute.
          </FormNote>
        )}
      </Dialog>

      {dialog === "view_evidence" && dialogMilestone?.evidence ? (
        <EvidenceDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          agreement={agreement}
          milestone={dialogMilestone}
        />
      ) : null}
    </div>
  );
}
