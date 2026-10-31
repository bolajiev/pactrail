"use client";

import * as React from "react";
import Link from "next/link";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  ExternalLink,
  FlaskConical,
  Globe2,
  Loader2,
  RadioTower,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react";
import { usePactRail } from "@/lib/store/pactrail-store";
import { useTokenBalance } from "@/lib/chain/hooks";
import {
  addressExplorerUrl,
  defaultChainId,
  liveNetworkOptions,
  networkFor,
} from "@/lib/chain/config";
import type { WorkspaceMode } from "@/lib/types";
import { PageHeader, Card, CardHeader, CopyButton } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { WalletButton } from "@/components/wallet/wallet-button";
import { formatTokenAmount, shortAddress } from "@/lib/utils";

function ModeOption({
  mode,
  active,
  onSelect,
  icon,
  title,
  description,
}: {
  mode: WorkspaceMode;
  active: boolean;
  onSelect: (mode: WorkspaceMode) => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(mode)}
      className={`rounded-xl border p-4 text-left transition-colors ${
        active
          ? "border-forest-700 bg-forest-50/60 ring-1 ring-forest-700"
          : "border-line bg-raised hover:border-ink/25"
      }`}
      aria-pressed={active}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-forest-700">
          {icon}
        </span>
        <span
          className={`flex h-4 w-4 items-center justify-center rounded-full border ${
            active ? "border-forest-700 bg-forest-700 text-white" : "border-line-strong"
          }`}
          aria-hidden
        >
          {active ? <CheckCircle2 className="h-3 w-3" /> : null}
        </span>
      </div>
      <p className="mt-3 text-[0.84rem] font-semibold text-ink">{title}</p>
      <p className="mt-1 text-[0.7rem] leading-relaxed text-ink-mute">{description}</p>
    </button>
  );
}

export default function SettingsPage() {
  const { state, setMode, resetDemoWorkspace, clearAllLocalData } = usePactRail();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { pushToast } = useToast();
  const network = networkFor(chainId);
  const balance = useTokenBalance(chainId, network?.tokenAddress ?? null, address);

  const [aiStatus, setAiStatus] = React.useState<{
    loading: boolean;
    configured: boolean;
    model?: string;
  }>({ loading: true, configured: false });
  const [resetOpen, setResetOpen] = React.useState(false);
  const [clearOpen, setClearOpen] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/status")
      .then((response) => response.json())
      .then((payload: { aiConfigured?: boolean; aiModel?: string }) => {
        if (!cancelled) {
          setAiStatus({
            loading: false,
            configured: Boolean(payload.aiConfigured),
            model: payload.aiModel,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setAiStatus({ loading: false, configured: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Configuration"
        title="Settings & network"
        description="Choose the workspace, inspect the configured escrow contracts, and control local data. Demo and live records are deliberately separated."
        action={<WalletButton />}
      />

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Workspace mode"
              description="Demo mode needs no wallet or API key. Live mode uses real testnet transactions."
            />
            <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
              <ModeOption
                mode="demo"
                active={state.mode === "demo"}
                onSelect={setMode}
                icon={<FlaskConical className="h-4 w-4" />}
                title="Demo workspace"
                description="Seeded sample agreements and locally simulated actions. Every simulated action is labelled DEMO EVENT and has no transaction hash."
              />
              <ModeOption
                mode="live"
                active={state.mode === "live"}
                onSelect={setMode}
                icon={<RadioTower className="h-4 w-4" />}
                title="Live testnet"
                description="Wallet-authorized escrow on Base Sepolia or a local Anvil chain. Requires a configured contract address and test token."
              />
            </div>
            <div className="border-t border-line px-5 py-3.5 text-[0.68rem] leading-relaxed text-ink-mute sm:px-6">
              Switching mode never moves funds and never converts a demo record into a live one.
              Demo sample data can be restored at any time without affecting live records.
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Wallet and balance"
              description="The connected account is the payer for new live agreements. PactRail never silently switches networks."
              action={
                isConnected ? (
                  <Badge tone="green" dot>
                    Connected
                  </Badge>
                ) : (
                  <Badge tone="neutral" dot>
                    Not connected
                  </Badge>
                )
              }
            />
            <div className="p-5 sm:p-6">
              {!isConnected || !address ? (
                <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-line bg-canvas/40 p-4 sm:flex-row sm:items-center">
                  <div className="flex items-start gap-2.5">
                    <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-ink-mute" />
                    <div>
                      <p className="text-[0.8rem] font-semibold text-ink">No wallet connected</p>
                      <p className="mt-0.5 text-[0.7rem] leading-relaxed text-ink-mute">
                        Connect an injected browser wallet to use live mode. Demo mode remains
                        available without one.
                      </p>
                    </div>
                  </div>
                  <WalletButton />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-line bg-canvas/40 px-3.5 py-3">
                      <p className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-ink-faint">
                        Account
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <code className="font-mono text-[0.72rem] text-ink">{shortAddress(address, 6)}</code>
                        <CopyButton value={address} label="" />
                      </div>
                    </div>
                    <div className="rounded-xl border border-line bg-canvas/40 px-3.5 py-3">
                      <p className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-ink-faint">
                        Network
                      </p>
                      <p className="mt-1 text-[0.74rem] font-semibold text-ink">
                        {network?.label ?? `Unsupported chain ${chainId}`}
                      </p>
                      <p className="mt-0.5 text-[0.62rem] text-ink-faint">Chain ID {chainId}</p>
                    </div>
                    <div className="rounded-xl border border-line bg-canvas/40 px-3.5 py-3">
                      <p className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-ink-faint">
                        {network?.tokenSymbol ?? "Token"} balance
                      </p>
                      <p className="tabular mt-1 text-[0.85rem] font-semibold text-ink">
                        {!network?.tokenAddress ? (
                          "Not configured"
                        ) : balance.isLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-mute" />
                        ) : balance.data !== undefined ? (
                          formatTokenAmount(balance.data, network.tokenDecimals, {
                            symbol: "",
                            minimumFractionDigits: 2,
                          })
                        ) : (
                          "—"
                        )}
                      </p>
                      <p className="mt-0.5 text-[0.62rem] text-ink-faint">
                        {network?.tokenSymbol ?? "test token"}
                      </p>
                    </div>
                  </div>

                  {!network ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-danger-200 bg-danger-50 px-3.5 py-3 text-[0.7rem] text-danger-800">
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        This network is not supported by the current PactRail build.
                      </span>
                      <div className="flex gap-1.5">
                        {liveNetworkOptions().map((option) => (
                          <Button
                            key={option.chain.id}
                            size="sm"
                            variant="secondary"
                            onClick={async () => {
                              try {
                                await switchChainAsync({ chainId: option.chain.id });
                                pushToast({ title: `Switched to ${option.label}`, tone: "success" });
                              } catch {
                                pushToast({ title: "Network switch was not completed", tone: "error" });
                              }
                            }}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {network && !network.escrowAddress ? (
                    <div className="flex items-start gap-2 rounded-xl border border-clay-200 bg-clay-50 px-3.5 py-3 text-[0.7rem] leading-relaxed text-clay-800">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      This network is supported by the app but has no escrow address in this build.
                      Deploy the contracts locally or set the Base Sepolia environment addresses.
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Network configuration"
              description="Addresses come from build-time environment variables. No addresses are invented at runtime."
            />
            <div className="divide-y divide-line">
              {liveNetworkOptions().map((option) => {
                const configured = Boolean(option.escrowAddress && option.tokenAddress);
                const isCurrent = option.chain.id === chainId;
                return (
                  <div key={option.chain.id} className="px-5 py-4 sm:px-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-canvas text-ink-mute">
                          <Globe2 className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-[0.8rem] font-semibold text-ink">{option.label}</p>
                          <p className="text-[0.62rem] text-ink-faint">
                            Chain ID {option.chain.id} ·{" "}
                            {option.isLocal ? "local development" : "public testnet"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isConnected && isCurrent ? (
                          <Badge tone="blue">Wallet network</Badge>
                        ) : null}
                        <Badge tone={configured ? "green" : "amber"}>
                          {configured ? "Configured" : "Missing addresses"}
                        </Badge>
                      </div>
                    </div>
                    <dl className="mt-3 grid gap-2 text-[0.68rem] sm:grid-cols-2">
                      <div>
                        <dt className="text-ink-faint">Escrow contract</dt>
                        <dd className="mt-0.5 break-all font-mono text-[0.64rem] text-ink-soft">
                          {option.escrowAddress ?? "—"}
                        </dd>
                        <dd className="mt-1 flex items-center gap-2">
                          {option.escrowAddress ? <CopyButton value={option.escrowAddress} /> : null}
                          {addressExplorerUrl(option.chain.id, option.escrowAddress) ? (
                            <a
                              href={addressExplorerUrl(option.chain.id, option.escrowAddress)!}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[0.64rem] font-semibold text-forest-700"
                            >
                              Explorer <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : null}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-ink-faint">Test token</dt>
                        <dd className="mt-0.5 break-all font-mono text-[0.64rem] text-ink-soft">
                          {option.tokenAddress ?? "—"}
                        </dd>
                        <dd className="mt-1 text-[0.62rem] text-ink-faint">
                          {option.tokenSymbol} · {option.tokenDecimals} decimals
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-ink-faint">RPC endpoint</dt>
                        <dd className="mt-0.5 break-all font-mono text-[0.62rem] text-ink-soft">
                          {option.rpcUrl}
                        </dd>
                      </div>
                    </dl>
                    {!configured ? (
                      <div className="mt-3 rounded-lg border border-line bg-canvas/50 px-3 py-2 text-[0.66rem] leading-relaxed text-ink-mute">
                        {option.isLocal ? (
                          <>
                            Run <code className="font-mono">npm run chain:node</code> in one terminal
                            and <code className="font-mono">npm run chain:deploy</code> in another,
                            then restart the app. See README for details.
                          </>
                        ) : (
                          <>
                            Set <code className="font-mono">NEXT_PUBLIC_BASE_SEPOLIA_ESCROW</code>{" "}
                            and <code className="font-mono">NEXT_PUBLIC_BASE_SEPOLIA_TOKEN</code> to
                            deployed testnet addresses.
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Agreement analysis"
              description="Keys stay server-side. Without one, a deterministic fallback is clearly labelled."
            />
            <div className="px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-canvas text-forest-700">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[0.78rem] font-semibold text-ink">
                    {aiStatus.loading
                      ? "Checking provider…"
                      : aiStatus.configured
                        ? "AI provider configured"
                        : "Rules-based demo extractor"}
                  </p>
                  <p className="text-[0.64rem] text-ink-faint">
                    {aiStatus.loading
                      ? ""
                      : aiStatus.configured
                        ? `Model: ${aiStatus.model}`
                        : "No API key in this environment"}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[0.68rem] leading-relaxed text-ink-mute">
                {aiStatus.configured
                  ? "Extraction requests are sent server-side to the configured OpenAI-compatible endpoint. Raw agreement text is not logged by PactRail and is never sent to the browser bundle."
                  : "Extraction uses deterministic rules and is labelled as such in the wizard. Set OPENAI_API_KEY and PACTRAIL_AI_MODEL to enable the model path."}
              </p>
              <div className="mt-3 rounded-lg border border-line bg-canvas/40 px-3 py-2 font-mono text-[0.62rem] text-ink-mute">
                OPENAI_API_KEY=••••••• (server only)
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Demo data controls" />
            <div className="space-y-3 px-5 py-4">
              <div className="flex items-start justify-between gap-3 rounded-xl border border-line bg-raised p-3.5">
                <div>
                  <p className="text-[0.76rem] font-semibold text-ink">Restore sample agreements</p>
                  <p className="mt-0.5 text-[0.66rem] leading-relaxed text-ink-mute">
                    Replaces demo records with the four seeded sample states. Live records are
                    preserved.
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setResetOpen(true)}>
                  <RefreshCcw className="h-3.5 w-3.5" />
                  Reset
                </Button>
              </div>
              <div className="flex items-start justify-between gap-3 rounded-xl border border-danger-200 bg-danger-50/40 p-3.5">
                <div>
                  <p className="text-[0.76rem] font-semibold text-danger-800">Clear local data</p>
                  <p className="mt-0.5 text-[0.66rem] leading-relaxed text-danger-700/80">
                    Removes all agreements, activity, and source copies from this browser. On-chain
                    state is not affected.
                  </p>
                </div>
                <Button variant="danger" size="sm" onClick={() => setClearOpen(true)}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Chainlink CCIP"
              description="Optional cross-chain audit mirror. Escrow settlement does not depend on it."
              action={<Badge tone="amber">Adapter tested · not deployed</Badge>}
            />
            <div className="space-y-3 px-5 py-4 text-[0.68rem] leading-relaxed text-ink-mute">
              <p>
                <span className="font-semibold text-ink-soft">CcipAuditSender</span> and{" "}
                <span className="font-semibold text-ink-soft">CcipAuditReceiver</span> compile
                against Chainlink CCIP 2.0 and pass local route, replay, sender, and fee tests with
                a mock router. They mirror agreement and evidence hashes to a destination chain
                without moving escrow funds.
              </p>
              <p>
                No live CCIP lane transfer is claimed in this build: the deployment requires
                testnet ETH and LINK that were not available in this environment. The production
                escrow flow is complete without CCIP.
              </p>
              <details>
                <summary className="cursor-pointer font-semibold text-forest-700">
                  Deployment path
                </summary>
                <p className="mt-2">
                  Deploy <code className="font-mono">DeployCcipReceiver.s.sol</code> on the
                  destination chain and{" "}
                  <code className="font-mono">DeployCcipSender.s.sol</code> on the source chain.
                  Configure the current router, LINK, lane chain selectors, and receiver address
                  from the official CCIP directory. See{" "}
                  <code className="font-mono">docs/ARCHITECTURE.md</code>.
                </p>
              </details>
            </div>
          </Card>

          <Card>
            <CardHeader title="Data & privacy" />
            <div className="space-y-3 px-5 py-4 text-[0.68rem] leading-relaxed text-ink-mute">
              <div className="flex items-start gap-2">
                <Database className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
                Agreement metadata is stored in localStorage for this prototype. Agreement text is
                only kept if you opt in during confirmation.
              </div>
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
                Evidence files are hashed in the browser and never uploaded. Only hashes and short
                references are recorded.
              </div>
              <div className="flex items-start gap-2">
                <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
                Test assets only. This prototype does not provide legal advice, identity
                verification, or regulatory compliance.
              </div>
            </div>
          </Card>

          <div className="rounded-2xl border border-line bg-forest-900 p-5 text-white">
            <p className="flex items-center gap-1.5 text-[0.64rem] font-bold uppercase tracking-[0.12em] text-white/55">
              <Globe2 className="h-3.5 w-3.5" /> Default network
            </p>
            <p className="mt-2 font-serif text-[1.25rem]">
              {networkFor(defaultChainId())?.label ?? "Not configured"}
            </p>
            <p className="mt-1 text-[0.68rem] leading-relaxed text-white/60">
              Set NEXT_PUBLIC_DEFAULT_CHAIN=local to make Anvil the initial network in development.
              Wallet switching is always explicit.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-surface px-5 py-4 text-[0.66rem] leading-relaxed text-ink-mute">
            <p className="font-semibold text-ink-soft">About this build</p>
            <p className="mt-1">
              PactRail 0.1.0 · hackathon prototype · {state.agreements.length} local records ·{" "}
              {state.agreements.filter((a) => a.mode === "live").length} live
            </p>
            <Link
              href="/overview"
              className="mt-2 inline-flex items-center gap-1 font-semibold text-forest-700 hover:text-forest-900"
            >
              Back to overview <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      <Dialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Restore demo sample data?"
        description="This replaces demo agreements and activity with the seeded sample states. Live records stay untouched."
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                resetDemoWorkspace();
                setResetOpen(false);
                pushToast({ title: "Demo workspace restored", tone: "success" });
              }}
            >
              <RefreshCcw className="h-4 w-4" /> Restore samples
            </Button>
          </>
        }
      >
        <p className="text-[0.78rem] leading-relaxed text-ink-soft">
          Any demo agreements you created will be removed. The four curated sample agreements and
          their timelines will be restored.
        </p>
      </Dialog>

      <Dialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Clear all local PactRail data?"
        description="This cannot be undone in this browser. It does not affect any blockchain state."
        footer={
          <>
            <Button variant="secondary" onClick={() => setClearOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                clearAllLocalData();
                setClearOpen(false);
                pushToast({
                  title: "Local data cleared",
                  description: "Sample demo data has been restored in a fresh workspace.",
                  tone: "info",
                });
              }}
            >
              <Trash2 className="h-4 w-4" /> Clear local data
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-[0.78rem] leading-relaxed text-ink-soft">
          <p>
            All locally stored agreement metadata, source copies, evidence metadata, and activity
            will be erased.
          </p>
          <p className="rounded-lg border border-clay-200 bg-clay-50 px-3 py-2 text-[0.72rem] text-clay-800">
            A live agreement deployed to a testnet remains on the blockchain, but this browser will
            lose the local title, descriptions, and source text needed to render it.
          </p>
        </div>
      </Dialog>
    </div>
  );
}
