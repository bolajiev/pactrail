"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount, useChainId } from "wagmi";
import { isAddress } from "viem";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Fingerprint,
  FlaskConical,
  Info,
  Loader2,
  LockKeyhole,
  Plus,
  ScanText,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wallet,
  XCircle,
} from "lucide-react";
import { usePactRail } from "@/lib/store/pactrail-store";
import { useEscrowActions } from "@/lib/chain/hooks";
import { defaultChainId, networkFor, txExplorerUrl } from "@/lib/chain/config";
import {
  computeTermsHash,
  canonicalStringify,
  type AgreementDraft,
} from "@/lib/agreement/canonical";
import { runPreflight } from "@/lib/agreement/preflight";
import { SAMPLE_AGREEMENT_TEXT } from "@/lib/demo/sample-agreement";
import type { AgreementAnalysis } from "@/lib/types";
import {
  analysisToForm,
  blankForm,
  draftTotal,
  emptyMilestone,
  firstInvalidMilestone,
  formToDraft,
  type WizardForm,
  type WizardMilestone,
  type WizardToken,
} from "@/components/wizard/wizard-model";
import {
  cn,
  formatTokenAmount,
  parseAmountToBaseUnits,
  toDateInput,
} from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CopyButton } from "@/components/ui/primitives";
import {
  Checkbox,
  Field,
  FormNote,
  Input,
  Label,
  Textarea,
} from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { WalletButton } from "@/components/wallet/wallet-button";

const STEPS = [
  { number: 1, label: "Source", hint: "Paste or load" },
  { number: 2, label: "Extract", hint: "Review proposals" },
  { number: 3, label: "Terms", hint: "Parties & schedule" },
  { number: 4, label: "Confirm", hint: "Hash & approve" },
];

const STATUS_LABELS: Record<string, string> = {
  extracted: "Extracted",
  inferred: "Inferred",
  missing: "Not found",
  needs_review: "Needs review",
};

const STATUS_TONES: Record<string, "green" | "amber" | "red" | "blue"> = {
  extracted: "green",
  inferred: "amber",
  missing: "red",
  needs_review: "blue",
};

function FieldConfidence({
  status,
  confidence,
}: {
  status: string;
  confidence: number;
}) {
  return (
    <Badge tone={STATUS_TONES[status] ?? "neutral"}>
      {STATUS_LABELS[status] ?? status} · {Math.round(confidence * 100)}%
    </Badge>
  );
}

function SourceExcerpt({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <blockquote className="mt-2 border-l-2 border-line-strong pl-2.5 text-[0.68rem] italic leading-relaxed text-ink-mute">
      “{text.length > 360 ? `${text.slice(0, 360)}…` : text}”
    </blockquote>
  );
}

function ExtractionField({
  label,
  value,
  onChange,
  status,
  confidence,
  excerpt,
  multiline,
  placeholder,
  id,
  testId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  status?: string;
  confidence?: number;
  excerpt?: string | null;
  multiline?: boolean;
  placeholder?: string;
  id: string;
  testId?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="text-[0.76rem] font-semibold text-ink-soft">
          {label}
        </label>
        {status ? <FieldConfidence status={status} confidence={confidence ?? 0} /> : null}
      </div>
      {multiline ? (
        <Textarea
          id={id}
          data-testid={testId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="min-h-[86px] text-[0.82rem]"
        />
      ) : (
        <Input
          id={id}
          data-testid={testId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="text-[0.82rem]"
        />
      )}
      <SourceExcerpt text={excerpt ?? null} />
    </div>
  );
}

function MilestoneEditor({
  milestone,
  index,
  token,
  onChange,
  onRemove,
  canRemove,
  extraction,
  error,
}: {
  milestone: WizardMilestone;
  index: number;
  token: WizardToken;
  onChange: (patch: Partial<WizardMilestone>) => void;
  onRemove: () => void;
  canRemove: boolean;
  extraction?: {
    status: string;
    confidence: number;
    source_excerpt: string | null;
  };
  error?: string | null;
}) {
  const parsed = parseAmountToBaseUnits(milestone.amount, token.decimals);
  return (
    <div className="rounded-xl border border-line bg-raised p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-line bg-canvas text-[0.66rem] font-bold text-ink-mute">
            {index + 1}
          </span>
          <h4 className="text-[0.88rem] text-ink">Milestone {index + 1}</h4>
          {extraction ? (
            <FieldConfidence
              status={extraction.status}
              confidence={extraction.confidence}
            />
          ) : null}
        </div>
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[0.66rem] font-semibold text-ink-mute transition-colors hover:bg-danger-50 hover:text-danger-600"
          >
            <Trash2 className="h-3 w-3" />
            Remove
          </button>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_150px_165px]">
        <Field label="Delivery / milestone" required>
          <Input
            value={milestone.description}
            onChange={(event) => onChange({ description: event.target.value })}
            placeholder="e.g. Design approval"
            className="text-[0.82rem]"
            aria-label={`Milestone ${index + 1} description`}
          />
        </Field>
        <Field
          label="Amount"
          required
          error={milestone.amount && !parsed.ok ? "Invalid amount" : error}
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[0.78rem] font-semibold text-ink-faint">
              $
            </span>
            <Input
              value={milestone.amount}
              onChange={(event) => onChange({ amount: event.target.value })}
              placeholder="1,000.00"
              inputMode="decimal"
              className="pl-6 text-[0.82rem]"
              aria-label={`Milestone ${index + 1} amount`}
            />
          </div>
        </Field>
        <Field label="Due date" required>
          <Input
            type="date"
            value={milestone.dueDate}
            onChange={(event) => onChange({ dueDate: event.target.value })}
            className="text-[0.78rem]"
            aria-label={`Milestone ${index + 1} due date`}
          />
        </Field>
      </div>

      <div className="mt-3">
        <Field
          label="Acceptance criteria"
          hint="What the payer will assess"
          description="State the evidence or deliverable that supports release. This stays in the reviewed terms, not on-chain."
        >
          <Textarea
            value={milestone.acceptanceCriteria}
            onChange={(event) => onChange({ acceptanceCriteria: event.target.value })}
            placeholder="The evidence should show…"
            className="min-h-[64px] text-[0.8rem]"
            aria-label={`Milestone ${index + 1} acceptance criteria`}
          />
        </Field>
      </div>
      {extraction?.source_excerpt ? (
        <SourceExcerpt text={extraction.source_excerpt} />
      ) : null}
    </div>
  );
}

function CheckRow({
  status,
  label,
  detail,
}: {
  status: "pass" | "warn" | "fail";
  label: string;
  detail: string;
}) {
  const icon =
    status === "pass" ? (
      <CheckCircle2 className="h-4 w-4 text-success-600" />
    ) : status === "warn" ? (
      <AlertTriangle className="h-4 w-4 text-clay-600" />
    ) : (
      <XCircle className="h-4 w-4 text-danger-500" />
    );
  return (
    <div className="flex items-start gap-2.5 px-4 py-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[0.74rem] font-semibold text-ink">{label}</p>
        <p className="mt-0.5 text-[0.67rem] leading-relaxed text-ink-mute">{detail}</p>
      </div>
      <Badge
        tone={status === "pass" ? "green" : status === "warn" ? "amber" : "red"}
        className="ml-auto shrink-0"
      >
        {status === "pass" ? "Pass" : status === "warn" ? "Review" : "Blocked"}
      </Badge>
    </div>
  );
}

function StepRail({
  step,
  onStepClick,
  extractionAvailable,
}: {
  step: number;
  onStepClick: (step: number) => void;
  extractionAvailable: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-line bg-surface p-2 sm:grid-cols-4">
      {STEPS.map((item) => {
        const active = step === item.number;
        const done = step > item.number;
        const clickable =
          item.number < step && (item.number !== 2 || extractionAvailable);
        return (
          <button
            key={item.number}
            type="button"
            onClick={() => clickable && onStepClick(item.number)}
            disabled={!clickable && !active}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors",
              active && "bg-forest-800 text-white",
              !active && clickable && "hover:bg-ink/[0.04]",
              !active && !clickable && "cursor-default",
            )}
            aria-current={active ? "step" : undefined}
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[0.62rem] font-bold",
                active
                  ? "border-white/25 bg-white/10 text-white"
                  : done
                    ? "border-forest-200 bg-forest-50 text-forest-700"
                    : "border-line bg-canvas text-ink-faint",
              )}
            >
              {done ? <Check className="h-3 w-3" /> : item.number}
            </span>
            <span className="min-w-0">
              <span
                className={cn(
                  "block text-[0.72rem] font-semibold",
                  active ? "text-white" : "text-ink",
                )}
              >
                {item.label}
              </span>
              <span
                className={cn(
                  "mt-0.5 hidden truncate text-[0.6rem] sm:block",
                  active ? "text-white/55" : "text-ink-faint",
                )}
              >
                {item.hint}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function CreateWizard() {
  const router = useRouter();
  const { state, createAgreement } = usePactRail();
  const { address } = useAccount();
  const walletChainId = useChainId();
  const escrow = useEscrowActions();
  const { pushToast, updateToast } = useToast();

  const mode = state.mode;
  const activeChainId = mode === "live" ? walletChainId : defaultChainId();
  const network = networkFor(activeChainId);
  const token = React.useMemo<WizardToken>(
    () =>
      mode === "live"
        ? {
            symbol: network?.tokenSymbol ?? "USDC",
            address: network?.tokenAddress ?? null,
            decimals: network?.tokenDecimals ?? 6,
          }
        : { symbol: "USDC", address: null, decimals: 6 },
    [mode, network],
  );

  const [step, setStep] = React.useState(1);
  const [source, setSource] = React.useState("");
  const [form, setForm] = React.useState<WizardForm>(() => blankForm());
  const [analysis, setAnalysis] = React.useState<AgreementAnalysis | null>(null);
  const [provenance, setProvenance] = React.useState<{
    mode: "ai" | "rules-demo";
    notice: string;
    model?: string;
  } | null>(null);
  const [manualEntry, setManualEntry] = React.useState(false);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [analyzeError, setAnalyzeError] = React.useState<string | null>(null);
  const [reviewConfirmed, setReviewConfirmed] = React.useState(false);
  const [saveSource, setSaveSource] = React.useState(false);
  const [terms, setTerms] = React.useState<Awaited<ReturnType<typeof computeTermsHash>> | null>(
    null,
  );
  const [hashing, setHashing] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (mode !== "live") return;
    setForm((current) =>
      current.payerAddress === (address ?? "")
        ? current
        : { ...current, payerAddress: address ?? "" },
    );
  }, [address, mode]);

  const draft = React.useMemo<AgreementDraft>(
    () => formToDraft(form, token, mode, mode === "live" ? activeChainId : null),
    [form, token, mode, activeChainId],
  );
  const preflight = React.useMemo(
    () => runPreflight(draft, { live: mode === "live" }),
    [draft, mode],
  );
  const total = React.useMemo(() => draftTotal(form, token.decimals), [form, token.decimals]);
  const datesValid = form.milestones.every(
    (milestone) =>
      milestone.dueDate && !Number.isNaN(new Date(`${milestone.dueDate}T23:59:59Z`).getTime()),
  );

  React.useEffect(() => {
    if (step !== 4 || !datesValid) {
      setTerms(null);
      return;
    }
    let cancelled = false;
    setHashing(true);
    computeTermsHash(draft)
      .then((result) => {
        if (!cancelled) {
          setTerms(result);
          setReviewConfirmed(false);
          setHashing(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTerms(null);
          setHashing(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [draft, step, datesValid]);

  const invalidMilestoneIndex = firstInvalidMilestone(form, token.decimals);
  const payerMatchesWallet =
    mode !== "live" ||
    (Boolean(address) &&
      form.payerAddress.toLowerCase() === address?.toLowerCase());
  const networkConfigured = Boolean(network?.escrowAddress && network?.tokenAddress);
  const liveBlockedReason =
    mode !== "live"
      ? null
      : !address
        ? "Connect a wallet to create a live agreement. The payer is the connected account."
        : !payerMatchesWallet
          ? "The payer address must match the connected wallet."
          : !networkConfigured
            ? "No escrow and test token are configured for this network."
            : null;

  function updateMilestone(key: string, patch: Partial<WizardMilestone>) {
    setForm((current) => ({
      ...current,
      milestones: current.milestones.map((milestone) =>
        milestone.key === key ? { ...milestone, ...patch } : milestone,
      ),
    }));
  }

  async function analyze() {
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const response = await fetch("/api/analyze-agreement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: source }),
      });
      const payload = (await response.json()) as
        | { analysis: AgreementAnalysis; mode: "ai" | "rules-demo"; notice: string; model?: string }
        | { error: string };
      if (!response.ok || !("analysis" in payload)) {
        throw new Error(
          "error" in payload ? payload.error : "Agreement analysis failed.",
        );
      }
      setAnalysis(payload.analysis);
      setProvenance({
        mode: payload.mode,
        notice: payload.notice,
        model: payload.model,
      });
      setManualEntry(false);
      setForm((current) => analysisToForm(payload.analysis, current));
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setAnalyzeError(
        error instanceof Error ? error.message : "Agreement analysis failed.",
      );
    } finally {
      setAnalyzing(false);
    }
  }

  function startManual() {
    setForm(blankForm());
    setAnalysis(null);
    setProvenance(null);
    setManualEntry(true);
    setStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    if (!terms || !preflight.ready || !reviewConfirmed) return;
    setCreating(true);
    setCreateError(null);
    let toastId: string | undefined;
    try {
      if (mode === "demo") {
        const agreement = createAgreement({
          draft,
          terms: terms.terms,
          termsHash: terms.hash,
          mode: "demo",
          sourceText: saveSource ? source : undefined,
          sourceSaved: saveSource,
        });
        pushToast({
          title: "Demo agreement created",
          description: "The record is awaiting funding in the demo workspace.",
          tone: "success",
        });
        router.push(`/agreements/${agreement.id}`);
        return;
      }

      if (!address) throw new Error("Connect a wallet first.");
      if (!network?.escrowAddress) throw new Error("Escrow contract is not configured.");
      if (!network.tokenAddress) throw new Error("Test token is not configured.");
      if (!payerMatchesWallet) {
        throw new Error("The payer address must match the connected wallet.");
      }

      toastId = pushToast({
        title: "Confirm in your wallet",
        description: "Creating the agreement and storing the approved terms hash.",
        tone: "pending",
        duration: 0,
      });

      const result = await escrow.createAgreement(draft, terms.hash as `0x${string}`, activeChainId);
      const explorer = txExplorerUrl(activeChainId, result.txHash);
      updateToast(toastId, {
        title: "Agreement created on-chain",
        description: "The milestone schedule and terms hash are now recorded.",
        tone: "success",
        duration: 6000,
        action: explorer ? { label: "View transaction", href: explorer } : undefined,
      });
      const agreement = createAgreement({
        draft,
        terms: terms.terms,
        termsHash: terms.hash,
        mode: "live",
        chain: {
          chainId: activeChainId,
          contractAddress: network.escrowAddress,
          onchainAgreementId: result.onchainAgreementId,
          createdAtTxHash: result.txHash,
        },
        sourceText: saveSource ? source : undefined,
        sourceSaved: saveSource,
        txHash: result.txHash,
      });
      router.push(`/agreements/${agreement.id}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The agreement could not be created.";
      setCreateError(message);
      if (toastId) {
        updateToast(toastId, {
          title: "Agreement was not created",
          description: message,
          tone: "error",
          duration: 9000,
        });
      } else {
        pushToast({ title: "Agreement was not created", description: message, tone: "error" });
      }
    } finally {
      setCreating(false);
    }
  }

  const stepTitle =
    step === 1
      ? "Start from the agreement"
      : step === 2
        ? "Review the proposed terms"
        : step === 3
          ? "Set parties and milestones"
          : "Confirm the approved terms";

  const stepDescription =
    step === 1
      ? "Paste a commercial agreement or load the sample. PactRail proposes structured payment terms; nothing is created until you confirm."
      : step === 2
        ? "Every proposed field is editable. Source excerpts show where a value came from; missing values stay empty."
        : step === 3
          ? "Assign the parties and wallet addresses, then finalize amounts and deadlines. Amounts use integer base units on-chain."
          : "Review the workflow checks and the exact canonical terms hash. The agreement is only created after your explicit approval.";

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-center gap-2 text-[0.72rem]">
        <Link
          href="/agreements"
          className="inline-flex items-center gap-1.5 font-semibold text-ink-mute hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Agreements
        </Link>
        <span className="text-ink-faint">/</span>
        <span className="font-semibold text-ink">New agreement</span>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone={mode === "demo" ? "sand" : "blue"}>
              {mode === "demo" ? <FlaskConical className="h-3 w-3" /> : <Wallet className="h-3 w-3" />}
              {mode === "demo" ? "Demo agreement" : "Live testnet agreement"}
            </Badge>
            <span className="text-[0.64rem] font-semibold uppercase tracking-[0.12em] text-ink-faint">
              Human approval required
            </span>
          </div>
          <h1 className="text-[2rem] leading-[1.08] text-ink sm:text-[2.4rem]">{stepTitle}</h1>
          <p className="mt-2.5 max-w-xl text-[0.84rem] leading-relaxed text-ink-mute">
            {stepDescription}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[0.68rem] text-ink-faint">
          <ShieldCheck className="h-4 w-4" />
          AI proposes. People approve. Contracts enforce.
        </div>
      </div>

      <StepRail
        step={step}
        extractionAvailable={Boolean(analysis)}
        onStepClick={(target) => {
          setStep(target);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />

      {step === 1 ? (
        <div className="grid gap-5 xl:grid-cols-[1.55fr_0.85fr]">
          <Card>
            <CardHeader
              title="Agreement source"
              description="Paste the operative payment terms. PactRail does not retain raw text unless you choose to save it."
              action={
                <div className="hidden items-center gap-1 rounded-lg border border-line bg-canvas/60 p-0.5 sm:flex">
                  <button
                    type="button"
                    onClick={() => setSource("")}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 text-[0.68rem] font-semibold",
                      source && source !== SAMPLE_AGREEMENT_TEXT
                        ? "bg-raised text-ink shadow-sm"
                        : "text-ink-mute hover:text-ink",
                    )}
                  >
                    Paste text
                  </button>
                  <button
                    type="button"
                    onClick={() => setSource(SAMPLE_AGREEMENT_TEXT)}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 text-[0.68rem] font-semibold",
                      source === SAMPLE_AGREEMENT_TEXT
                        ? "bg-raised text-ink shadow-sm"
                        : "text-ink-mute hover:text-ink",
                    )}
                  >
                    Sample
                  </button>
                </div>
              }
            />
            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
                <Label htmlFor="agreement-source" hint={`${source.length.toLocaleString()} characters`}>
                  Agreement text
                </Label>
                <button
                  type="button"
                  onClick={() => setSource(SAMPLE_AGREEMENT_TEXT)}
                  className="text-[0.68rem] font-semibold text-forest-700 hover:text-forest-900"
                >
                  Load sample agreement
                </button>
              </div>
              <Textarea
                id="agreement-source"
                data-testid="agreement-source-textarea"
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder="Paste the agreement text here. Include parties, payment amounts, milestones, deadlines, acceptance conditions, and the dispute process if present."
                className="min-h-[390px] font-[450] leading-[1.75]"
                spellCheck={false}
              />
              {analyzeError ? (
                <div className="mt-3">
                  <FormNote tone="danger">{analyzeError}</FormNote>
                </div>
              ) : null}
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={startManual}
                  className="text-left text-[0.7rem] font-semibold text-ink-mute underline decoration-line-strong underline-offset-4 hover:text-ink"
                >
                  Enter terms manually instead
                </button>
                <Button
                  type="button"
                  data-testid="analyze-button"
                  onClick={() => void analyze()}
                  loading={analyzing}
                  loadingText="Analysing"
                  disabled={source.trim().length < 20}
                >
                  <ScanText className="h-4 w-4" />
                  Analyse agreement
                </Button>
              </div>
            </div>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader
                title="What happens next"
                description="Three human checkpoints before any settlement state is created."
              />
              <ol className="divide-y divide-line">
                {[
                  {
                    title: "Proposal",
                    body: "The extractor proposes fields with confidence values and source excerpts. Missing values remain empty.",
                  },
                  {
                    title: "Review",
                    body: "You edit names, amounts, dates, and acceptance criteria. The AI never writes terms directly into escrow.",
                  },
                  {
                    title: "Approval",
                    body: "You confirm the canonical terms and SHA-256 hash. Only then can funding or any on-chain action begin.",
                  },
                ].map((item, index) => (
                  <li key={item.title} className="flex gap-3 px-5 py-4">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line bg-canvas text-[0.64rem] font-bold text-ink-mute">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-[0.76rem] font-semibold text-ink">{item.title}</p>
                      <p className="mt-0.5 text-[0.69rem] leading-relaxed text-ink-mute">{item.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>

            <div className="rounded-2xl border border-line bg-canvas/50 p-5">
              <div className="flex items-center gap-2">
                <LockKeyhole className="h-4 w-4 text-forest-700" />
                <p className="text-[0.72rem] font-bold uppercase tracking-[0.1em] text-ink-faint">
                  Privacy by default
                </p>
              </div>
              <p className="mt-2 text-[0.71rem] leading-relaxed text-ink-mute">
                Raw agreement text is not logged by the analysis endpoint. It is not saved with the
                agreement unless you explicitly choose to keep it as a local source copy at the
                final step.
              </p>
              <p className="mt-2 text-[0.71rem] leading-relaxed text-ink-mute">
                Evidence files stay in your browser. Only the SHA-256 hash and an optional short
                reference are sent to the escrow.
              </p>
            </div>

            <div className="rounded-2xl border border-clay-200 bg-clay-50 px-5 py-4">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-clay-700" />
                <p className="text-[0.69rem] leading-relaxed text-clay-800">
                  If no AI API key is configured, a deterministic rules-based extractor runs and is
                  clearly labelled. It is not a language model. Review every field in either mode.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {step === 2 && analysis ? (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-canvas text-forest-700">
                {provenance?.mode === "ai" ? (
                  <Sparkles className="h-4 w-4" />
                ) : (
                  <FlaskConical className="h-4 w-4" />
                )}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[0.8rem] font-semibold text-ink">
                    {provenance?.mode === "ai"
                      ? "AI-proposed extraction"
                      : "Rules-based demo extraction"}
                  </p>
                  <Badge tone={provenance?.mode === "ai" ? "blue" : "amber"}>
                    Proposed terms — not approved
                  </Badge>
                  {provenance?.model ? (
                    <span className="text-[0.62rem] text-ink-faint">{provenance.model}</span>
                  ) : null}
                </div>
                <p className="mt-1 max-w-3xl text-[0.71rem] leading-relaxed text-ink-mute">
                  {provenance?.notice}
                </p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setStep(1)}>
              Change source
            </Button>
          </div>

          {analysis.issues_for_human_review.length > 0 ? (
            <div className="rounded-2xl border border-clay-200 bg-clay-50 p-5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-clay-700" />
                <p className="text-[0.76rem] font-semibold text-clay-900">
                  Items for human review
                </p>
              </div>
              <ul className="mt-2 grid gap-1.5 text-[0.71rem] leading-relaxed text-clay-800 sm:grid-cols-2">
                {analysis.issues_for_human_review.map((issue, index) => (
                  <li key={`${issue}-${index}`} className="flex gap-1.5">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-clay-500" />
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Card>
            <CardHeader
              title="Agreement details"
              description="Edit any proposed value. Nothing here is treated as confirmed."
            />
            <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-2">
              <ExtractionField
                id="wizard-title"
                label="Agreement title"
                value={form.title}
                onChange={(value) => setForm((current) => ({ ...current, title: value }))}
                status={analysis.title.status}
                confidence={analysis.title.confidence}
                excerpt={analysis.title.source_excerpt}
                placeholder="e.g. Website redesign and development"
              />
              <ExtractionField
                id="wizard-jurisdiction"
                label="Jurisdiction / context"
                value={form.jurisdiction}
                onChange={(value) =>
                  setForm((current) => ({ ...current, jurisdiction: value }))
                }
                status={analysis.jurisdiction.status}
                confidence={analysis.jurisdiction.confidence}
                excerpt={analysis.jurisdiction.source_excerpt}
                placeholder="Informational only, e.g. England and Wales"
              />
              <div className="lg:col-span-2">
                <ExtractionField
                  id="wizard-summary"
                  label="Scope summary"
                  value={form.summary}
                  onChange={(value) => setForm((current) => ({ ...current, summary: value }))}
                  status={analysis.scope.status}
                  confidence={analysis.scope.confidence}
                  excerpt={analysis.scope.source_excerpt}
                  multiline
                  placeholder="Short summary of the work or commercial relationship"
                />
              </div>
              <div className="rounded-xl border border-line bg-canvas/40 p-4 lg:col-span-2">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[0.64rem] font-bold uppercase tracking-[0.1em] text-ink-faint">
                        Settlement asset
                      </p>
                      <FieldConfidence
                        status={analysis.currency.status}
                        confidence={analysis.currency.confidence}
                      />
                    </div>
                    <p className="mt-1 text-[0.82rem] font-semibold text-ink">
                      {token.symbol}{" "}
                      <span className="text-[0.66rem] font-medium text-ink-faint">
                        · {mode === "live" ? network?.label ?? "live network" : "demo token"}
                      </span>
                    </p>
                    <p className="mt-1 text-[0.68rem] text-ink-mute">
                      The configured test token is used. Extracted currency:{" "}
                      {analysis.currency.value ?? "not found"}
                      {analysis.currency.value &&
                      analysis.currency.value.toUpperCase() !== token.symbol.toUpperCase()
                        ? " — check this before continuing."
                        : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.64rem] font-bold uppercase tracking-[0.1em] text-ink-faint">
                      Extracted total
                    </p>
                    <p className="mt-1 text-[0.82rem] font-semibold text-ink">
                      {analysis.total_amount.value
                        ? `$${analysis.total_amount.value}`
                        : "Not found"}
                      {analysis.total_amount.status === "inferred" ? (
                        <span className="ml-1.5 text-[0.64rem] font-medium text-clay-700">
                          inferred
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-[0.68rem] text-ink-mute">
                      Milestone amounts below determine the final total.
                    </p>
                    <SourceExcerpt text={analysis.total_amount.source_excerpt} />
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Parties"
              description="Names are extracted; wallet addresses are assigned in the next step."
            />
            <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-3">
              {(
                [
                  { role: "payer", label: "Payer / client", value: form.payerName, key: "payerName" },
                  { role: "payee", label: "Payee / contractor", value: form.payeeName, key: "payeeName" },
                  { role: "arbitrator", label: "Arbitrator", value: form.arbitratorName, key: "arbitratorName" },
                ] as const
              ).map((party) => {
                const extracted = analysis.parties.find((entry) => entry.role === party.role);
                return (
                  <div key={party.role} className="rounded-xl border border-line bg-raised p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[0.64rem] font-bold uppercase tracking-[0.1em] text-ink-faint">
                        {party.label}
                      </p>
                      {extracted ? (
                        <FieldConfidence
                          status={extracted.name_status}
                          confidence={extracted.name_confidence}
                        />
                      ) : null}
                    </div>
                    <Label htmlFor={`party-${party.role}`} className="mt-2">
                      Legal name
                    </Label>
                    <Input
                      id={`party-${party.role}`}
                      value={party.value}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, [party.key]: event.target.value }))
                      }
                      placeholder={extracted?.name ? undefined : "Not found — enter manually"}
                      className="mt-1 text-[0.8rem]"
                    />
                    <SourceExcerpt text={extracted?.source_excerpt ?? null} />
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Milestones"
              description="Amounts and dates are proposals. Edit the payment schedule before continuing."
              action={
                <Badge tone="sand">
                  <ClipboardCheck className="h-3 w-3" />
                  {form.milestones.length} proposed
                </Badge>
              }
            />
            <div className="space-y-3 p-5 sm:p-6">
              {form.milestones.map((milestone, index) => (
                <MilestoneEditor
                  key={milestone.key}
                  milestone={milestone}
                  index={index}
                  token={token}
                  extraction={analysis.milestones[index]}
                  onChange={(patch) => updateMilestone(milestone.key, patch)}
                  onRemove={() =>
                    setForm((current) => ({
                      ...current,
                      milestones: current.milestones.filter(
                        (item) => item.key !== milestone.key,
                      ),
                    }))
                  }
                  canRemove={form.milestones.length > 1}
                />
              ))}
              <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      milestones: [...current.milestones, emptyMilestone()],
                    }))
                  }
                  disabled={form.milestones.length >= 32}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add milestone
                </Button>
                <p className="text-[0.72rem] text-ink-mute">
                  Schedule total{" "}
                  <span className="tabular font-semibold text-ink">
                    {total.invalid
                      ? "—"
                      : formatTokenAmount(total.total, token.decimals)}
                  </span>{" "}
                  {token.symbol}
                </p>
              </div>
            </div>
          </Card>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4" /> Back to source
            </Button>
            <Button type="button" data-testid="review-continue" onClick={() => setStep(3)}>
              Continue to parties
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-5">
          {manualEntry ? (
            <FormNote>
              Manual entry selected. Extraction was skipped; every field below must be completed
              and confirmed by the parties.
            </FormNote>
          ) : null}

          {mode === "live" ? (
            <div className="rounded-2xl border border-navy-200 bg-navy-50 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2.5">
                  <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-navy-700" />
                  <div>
                    <p className="text-[0.76rem] font-semibold text-navy-900">
                      Live settlement requires a wallet
                    </p>
                    <p className="mt-0.5 text-[0.69rem] leading-relaxed text-navy-800">
                      {address
                        ? `Connected on ${network?.label ?? `chain ${walletChainId}`}. The payer is fixed to the connected account.`
                        : "Connect the payer wallet. The connected account becomes the payer; payee and arbitrator need their own addresses."}
                    </p>
                  </div>
                </div>
                {!address ? <WalletButton compact /> : null}
              </div>
              {address && !networkConfigured ? (
                <div className="mt-3 rounded-lg border border-clay-200 bg-clay-50 px-3 py-2 text-[0.69rem] text-clay-800">
                  This build has no escrow contract or test token configured for{" "}
                  {network?.label ?? `chain ${walletChainId}`}. Configure environment addresses or
                  switch network.{" "}
                  <Link href="/settings" className="font-semibold underline underline-offset-2">
                    Network settings
                  </Link>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-clay-200 bg-clay-50 px-5 py-3.5 text-[0.7rem] leading-relaxed text-clay-800">
              Demo mode uses role identities instead of wallet addresses. Actions remain local demo
              events and are never presented as blockchain transactions.
            </div>
          )}

          <Card>
            <CardHeader
              title="Agreement and parties"
              description="The payer signs the creation transaction. Payee and arbitrator are fixed in the agreement and cannot be changed after funding."
            />
            <div className="space-y-5 p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Agreement title" required>
                  <Input
                    value={form.title}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, title: event.target.value }))
                    }
                    placeholder="Website redesign and development"
                  />
                </Field>
                <Field label="Jurisdiction / context" hint="Informational only">
                  <Input
                    value={form.jurisdiction}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, jurisdiction: event.target.value }))
                    }
                    placeholder="England and Wales"
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Scope summary">
                    <Textarea
                      value={form.summary}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, summary: event.target.value }))
                      }
                      className="min-h-[74px]"
                      placeholder="Short summary of the work and commercial relationship."
                    />
                  </Field>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                {(
                  [
                    {
                      role: "payer",
                      label: "Payer / client",
                      nameKey: "payerName",
                      addressKey: "payerAddress",
                      address: form.payerAddress,
                      locked: true,
                    },
                    {
                      role: "payee",
                      label: "Payee / contractor",
                      nameKey: "payeeName",
                      addressKey: "payeeAddress",
                      address: form.payeeAddress,
                      locked: false,
                    },
                    {
                      role: "arbitrator",
                      label: "Arbitrator",
                      nameKey: "arbitratorName",
                      addressKey: "arbitratorAddress",
                      address: form.arbitratorAddress,
                      locked: false,
                    },
                  ] as const
                ).map((party) => {
                  const name = form[party.nameKey];
                  const validAddress =
                    mode === "demo" || !party.address || isAddress(party.address);
                  return (
                    <div key={party.role} className="rounded-xl border border-line bg-raised p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[0.64rem] font-bold uppercase tracking-[0.1em] text-ink-faint">
                          {party.label}
                        </p>
                        <span className="capitalize text-[0.6rem] text-ink-faint">{party.role}</span>
                      </div>
                      <Field label="Name" required className="mt-2">
                        <Input
                          value={name}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              [party.nameKey]: event.target.value,
                            }))
                          }
                          placeholder="Legal name"
                          className="text-[0.8rem]"
                          aria-label={`${party.label} name`}
                        />
                      </Field>
                      {mode === "live" ? (
                        <Field
                          label="Wallet address"
                          required
                          hint={party.locked ? "Connected account" : undefined}
                          error={!validAddress ? "Enter a valid 0x address" : null}
                          className="mt-3"
                        >
                          <Input
                            value={party.address}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                [party.addressKey]: event.target.value,
                              }))
                            }
                            readOnly={party.locked}
                            placeholder="0x…"
                            className={cn(
                              "font-mono text-[0.7rem]",
                              party.locked && "bg-canvas/60",
                            )}
                            aria-label={`${party.label} address`}
                            data-testid={`party-${party.role}-address`}
                          />
                        </Field>
                      ) : (
                        <p className="mt-3 rounded-lg border border-dashed border-line px-2.5 py-2 text-[0.66rem] leading-relaxed text-ink-faint">
                          Demo identity — no wallet address is recorded.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
            <Card>
              <CardHeader
                title="Milestone schedule"
                description="Each amount is an exact token quantity. The total is the sum of milestones."
                action={
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        milestones: [...current.milestones, emptyMilestone()],
                      }))
                    }
                    disabled={form.milestones.length >= 32}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                }
              />
              <div className="space-y-3 p-5 sm:p-6">
                {form.milestones.map((milestone, index) => (
                  <MilestoneEditor
                    key={milestone.key}
                    milestone={milestone}
                    index={index}
                    token={token}
                    onChange={(patch) => updateMilestone(milestone.key, patch)}
                    onRemove={() =>
                      setForm((current) => ({
                        ...current,
                        milestones: current.milestones.filter(
                          (item) => item.key !== milestone.key,
                        ),
                      }))
                    }
                    canRemove={form.milestones.length > 1}
                    error={
                      index === invalidMilestoneIndex ? "Complete this milestone" : null
                    }
                  />
                ))}
              </div>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader title="Settlement asset" />
                <div className="space-y-3 px-5 py-4 text-[0.72rem]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-ink-faint">Token</span>
                    <span className="font-semibold text-ink">{token.symbol}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-ink-faint">Network</span>
                    <span className="font-semibold text-ink">
                      {mode === "demo" ? "Demo (local)" : network?.label ?? "Unsupported"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-ink-faint">Decimals</span>
                    <span className="font-semibold text-ink">{token.decimals}</span>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-ink-faint">Address</span>
                    <span className="text-right font-mono text-[0.64rem] text-ink-mute">
                      {token.address ?? "Demo token"}
                    </span>
                  </div>
                  <div className="border-t border-line pt-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-ink-faint">Total</span>
                      <span className="tabular font-serif text-xl text-ink">
                        {total.invalid ? "—" : formatTokenAmount(total.total, token.decimals)}
                      </span>
                    </div>
                    <p className="mt-1 text-right text-[0.62rem] text-ink-faint">
                      {token.symbol} in integer base units
                    </p>
                  </div>
                </div>
              </Card>
              <div className="rounded-xl border border-line bg-canvas/50 px-4 py-3 text-[0.68rem] leading-relaxed text-ink-mute">
                <div className="flex items-center gap-1.5 font-semibold text-ink-soft">
                  <LockKeyhole className="h-3.5 w-3.5" />
                  Immutable after funding
                </div>
                <p className="mt-1">
                  The arbitrator cannot be swapped and milestone amounts cannot be edited after
                  funding. A dispute keeps that milestone locked until resolution.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep(analysis ? 2 : 1)}
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button
              type="button"
              data-testid="terms-continue"
              onClick={() => {
                setStep(4);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              Review and confirm
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="grid gap-5 xl:grid-cols-[1.5fr_0.9fr]">
          <div className="space-y-5">
            <Card>
              <CardHeader
                title="Workflow preflight"
                description="Deterministic checks of the draft. These are workflow checks, not legal compliance certification."
                action={
                  <Badge tone={preflight.ready ? "green" : "red"}>
                    {preflight.ready
                      ? "Ready to confirm"
                      : `${preflight.blockers} blocker${preflight.blockers === 1 ? "" : "s"}`}
                  </Badge>
                }
              />
              <div className="divide-y divide-line better-scroll">
                {preflight.checks.map((check) => (
                  <CheckRow
                    key={check.id}
                    status={check.status}
                    label={check.label}
                    detail={check.detail}
                  />
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Terms summary"
                description="This exact structure is canonicalized and hashed. Milestone descriptions and documents stay off-chain."
              />
              <div className="p-5 sm:p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-ink-faint">
                      Agreement
                    </p>
                    <p className="mt-1 text-[0.92rem] font-semibold text-ink">{draft.title || "—"}</p>
                    <p className="mt-1 text-[0.7rem] leading-relaxed text-ink-mute">
                      {draft.summary || "No scope summary"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-ink-faint">
                      Settlement
                    </p>
                    <p className="mt-1 tabular text-[1.15rem] font-serif text-ink">
                      {formatTokenAmount(draft.totalAmountBaseUnits, token.decimals)}{" "}
                      <span className="text-[0.66rem] font-sans font-medium text-ink-faint">
                        {token.symbol}
                      </span>
                    </p>
                    <p className="mt-1 text-[0.7rem] text-ink-mute">
                      {mode === "demo" ? "Demo workspace" : network?.label ?? "Unsupported network"} ·{" "}
                      {draft.milestones.length} milestones
                    </p>
                  </div>
                </div>

                <dl className="mt-5 grid gap-3 border-t border-line pt-4 text-[0.72rem] sm:grid-cols-3">
                  <div>
                    <dt className="text-ink-faint">Payer</dt>
                    <dd className="mt-0.5 font-semibold text-ink">{draft.payer.name || "—"}</dd>
                    {mode === "live" ? (
                      <dd className="mt-0.5 break-all font-mono text-[0.62rem] text-ink-mute">
                        {draft.payer.address ?? "—"}
                      </dd>
                    ) : null}
                  </div>
                  <div>
                    <dt className="text-ink-faint">Payee</dt>
                    <dd className="mt-0.5 font-semibold text-ink">{draft.payee.name || "—"}</dd>
                    {mode === "live" ? (
                      <dd className="mt-0.5 break-all font-mono text-[0.62rem] text-ink-mute">
                        {draft.payee.address ?? "—"}
                      </dd>
                    ) : null}
                  </div>
                  <div>
                    <dt className="text-ink-faint">Arbitrator</dt>
                    <dd className="mt-0.5 font-semibold text-ink">
                      {draft.arbitrator.name || "—"}
                    </dd>
                    {mode === "live" ? (
                      <dd className="mt-0.5 break-all font-mono text-[0.62rem] text-ink-mute">
                        {draft.arbitrator.address ?? "—"}
                      </dd>
                    ) : null}
                  </div>
                </dl>

                <div className="mt-5 overflow-hidden rounded-xl border border-line">
                  <table className="w-full text-left text-[0.7rem]">
                    <thead className="bg-canvas/60 text-[0.58rem] uppercase tracking-[0.1em] text-ink-faint">
                      <tr>
                        <th className="px-3 py-2 font-bold">#</th>
                        <th className="px-3 py-2 font-bold">Milestone</th>
                        <th className="px-3 py-2 font-bold">Due</th>
                        <th className="px-3 py-2 text-right font-bold">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {draft.milestones.map((milestone, index) => (
                        <tr key={milestone.id}>
                          <td className="px-3 py-2.5 text-ink-faint">{index + 1}</td>
                          <td className="px-3 py-2.5 font-medium text-ink">
                            {milestone.description}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-ink-mute">
                            {milestone.dueAt ? toDateInput(milestone.dueAt) : "—"}
                          </td>
                          <td className="tabular whitespace-nowrap px-3 py-2.5 text-right font-semibold text-ink">
                            {formatTokenAmount(milestone.amountBaseUnits, token.decimals)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-5 rounded-xl border border-line bg-canvas/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-ink-faint">
                      <Fingerprint className="h-3.5 w-3.5" />
                      Canonical terms hash
                    </p>
                    {terms ? <CopyButton value={terms.hash} label="Copy hash" /> : null}
                  </div>
                  <div className="mt-2">
                    {hashing ? (
                      <div className="flex items-center gap-2 text-[0.72rem] text-ink-mute">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Computing SHA-256 of the canonical terms…
                      </div>
                    ) : terms ? (
                      <code className="hash block break-all rounded-lg border border-line bg-raised p-2.5 text-ink-soft">
                        {terms.hash}
                      </code>
                    ) : (
                      <p className="text-[0.7rem] text-danger-600">
                        Add a valid due date to every milestone to generate the hash.
                      </p>
                    )}
                  </div>
                  <p className="mt-2 text-[0.64rem] leading-relaxed text-ink-faint">
                    Toggle the canonical JSON below to inspect exactly what is hashed. The source
                    agreement text is not included.
                  </p>
                  {terms ? (
                    <details className="group mt-2">
                      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[0.68rem] font-semibold text-forest-700 hover:text-forest-900">
                        <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                        Canonical terms JSON
                      </summary>
                      <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-line bg-raised p-3 text-[0.62rem] leading-relaxed text-ink-soft scrollbar-thin">
                        {JSON.stringify(JSON.parse(canonicalStringify(terms.terms)), null, 2)}
                      </pre>
                    </details>
                  ) : null}
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader title="Explicit approval" />
              <div className="space-y-3 px-5 py-4">
                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-raised p-3.5">
                  <Checkbox
                    checked={reviewConfirmed}
                    onChange={(event) => setReviewConfirmed(event.target.checked)}
                    data-testid="review-confirm-checkbox"
                  />
                  <span>
                    <span className="block text-[0.74rem] font-semibold text-ink">
                      The parties have reviewed and approved these terms.
                    </span>
                    <span className="mt-0.5 block text-[0.66rem] leading-relaxed text-ink-mute">
                      I understand that AI did not approve these terms, set a deadline, or authorize
                      a payment. This action creates the agreement record.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-canvas/40 p-3.5">
                  <Checkbox
                    checked={saveSource}
                    onChange={(event) => setSaveSource(event.target.checked)}
                  />
                  <span>
                    <span className="block text-[0.74rem] font-semibold text-ink">
                      Save the source text locally (optional)
                    </span>
                    <span className="mt-0.5 block text-[0.66rem] leading-relaxed text-ink-mute">
                      Off by default. If enabled, the pasted text is stored in this browser with the
                      agreement record. It is never uploaded or written on-chain.
                    </span>
                  </span>
                </label>
              </div>
            </Card>

            <div className="rounded-2xl border border-line bg-forest-900 p-5 text-white">
              <div className="flex items-center gap-2 text-[0.64rem] font-bold uppercase tracking-[0.12em] text-white/55">
                <ShieldCheck className="h-3.5 w-3.5" />
                {mode === "demo" ? "Demo creation" : "On-chain creation"}
              </div>
              <p className="mt-2 text-[0.74rem] leading-relaxed text-white/75">
                {mode === "demo"
                  ? "Creates a local demo agreement in the awaiting-funding state. No wallet, token transfer, or blockchain transaction occurs."
                  : "Your wallet will ask you to confirm createAgreement. The terms hash and milestone schedule become part of the escrow contract. No tokens move until the funding step."}
              </p>
              {mode === "live" ? (
                <div className="mt-3 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-[0.68rem] leading-relaxed text-white/70">
                  {address
                    ? `Payer: ${draft.payer.address ?? "not set"}`
                    : "Connect a wallet to continue."}
                </div>
              ) : null}
            </div>

            {liveBlockedReason ? (
              <FormNote tone="warning">{liveBlockedReason}</FormNote>
            ) : null}
            {!preflight.ready ? (
              <FormNote tone="danger">
                Resolve the blocked workflow checks before creating the agreement. Use the back
                button to edit the terms.
              </FormNote>
            ) : null}
            {createError ? <FormNote tone="danger">{createError}</FormNote> : null}

            <Button
              type="button"
              size="lg"
              className="w-full"
              data-testid="create-agreement-button"
              onClick={() => void submit()}
              loading={creating}
              loadingText={mode === "live" ? "Waiting for confirmation" : "Creating"}
              disabled={
                !preflight.ready ||
                !reviewConfirmed ||
                !terms ||
                hashing ||
                Boolean(liveBlockedReason)
              }
            >
              <Check className="h-4 w-4" />
              {mode === "live" ? "Create on-chain agreement" : "Create demo agreement"}
            </Button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="w-full text-center text-[0.68rem] font-semibold text-ink-mute hover:text-ink"
            >
              Back to edit terms
            </button>

            <p className="px-1 text-[0.62rem] leading-relaxed text-ink-faint">
              PactRail is a hackathon prototype using test assets. It is not legal advice and does
              not establish legal enforceability, identity verification, or regulatory compliance.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
