"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CircleDollarSign,
  Clock3,
  FilePlus2,
  FlaskConical,
  Gavel,
  Scale,
  Sparkles,
  Upload,
  WalletCards,
} from "lucide-react";
import { useAccount } from "wagmi";
import { usePactRail, useWorkspaceAgreements } from "@/lib/store/pactrail-store";
import { Card, CardHeader, Stat, EmptyState, ProgressBar } from "@/components/ui/primitives";
import { AgreementTable } from "@/components/agreements/agreement-table";
import { AgreementStatusBadge, DemoBadge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import {
  deriveAgreementStatus,
  fundedEscrowBaseUnits,
  nextMilestone,
} from "@/lib/agreement/status";
import { formatDate, formatTokenAmount, relativeTime } from "@/lib/utils";
import { roleForAddress } from "@/lib/agreement/permissions";

const HOW_IT_WORKS = [
  {
    icon: Sparkles,
    title: "Extract",
    body: "Proposed parties, amounts, deadlines, and acceptance terms are pulled from the agreement.",
  },
  {
    icon: Scale,
    title: "Review",
    body: "The parties correct every field and approve a canonical terms hash. AI never finalizes terms.",
  },
  {
    icon: WalletCards,
    title: "Fund",
    body: "The payer deposits the full test-stablecoin amount into a milestone escrow contract.",
  },
  {
    icon: Upload,
    title: "Settle",
    body: "Evidence hashes are recorded. Payment releases only on approval, or after arbitration.",
  },
];

export default function OverviewPage() {
  const { state } = usePactRail();
  const agreements = useWorkspaceAgreements();
  const { address } = useAccount();
  const [greeting, setGreeting] = React.useState("Good morning");

  React.useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
  }, []);

  const funded = agreements.filter((agreement) => Boolean(agreement.fundedAt));
  const active = funded.filter((agreement) => deriveAgreementStatus(agreement) !== "completed");
  const escrow = active.reduce(
    (sum, agreement) => sum + fundedEscrowBaseUnits(agreement),
    0n,
  );
  const awaiting = agreements.flatMap((agreement) =>
    agreement.milestones
      .filter((milestone) => milestone.status === "submitted")
      .map((milestone) => ({ agreement, milestone })),
  );
  const disputed = agreements.flatMap((agreement) =>
    agreement.milestones
      .filter((milestone) => milestone.status === "disputed")
      .map((milestone) => ({ agreement, milestone })),
  );
  const needsAttention = agreements
    .filter((agreement) => {
      const status = deriveAgreementStatus(agreement);
      return status === "disputed" || status === "awaiting_approval" || status === "awaiting_funding";
    })
    .sort((left, right) => {
      const order = { disputed: 0, awaiting_approval: 1, awaiting_funding: 2 } as const;
      return (
        order[deriveAgreementStatus(left) as keyof typeof order] -
        order[deriveAgreementStatus(right) as keyof typeof order]
      );
    })
    .slice(0, 3);
  const recent = [...agreements]
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, 4);

  const workspaceLabel = state.mode === "demo" ? "demo workspace" : "live workspace";
  const today = formatDate(new Date());

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[0.66rem] font-bold uppercase tracking-[0.16em] text-ink-faint">
              {today} · {workspaceLabel}
            </span>
            {state.mode === "demo" ? <DemoBadge label="Sample data" /> : null}
          </div>
          <h1 className="text-[2.15rem] leading-[1.08] text-ink sm:text-[2.7rem]">
            {greeting}.
            <span className="text-ink-mute"> Here is the settlement picture.</span>
          </h1>
          <p className="mt-3 max-w-xl text-[0.88rem] leading-relaxed text-ink-mute">
            {agreements.length === 0
              ? "Start with a sample agreement or create one from your own text. Every field is reviewed before money can move."
              : `${agreements.length} agreement${
                  agreements.length === 1 ? "" : "s"
                } linked to reviewed terms, milestone evidence, and a verifiable activity trail.`}{" "}
            {state.mode === "demo"
              ? "Demo actions are simulated locally."
              : address
                ? "Live actions use your connected testnet wallet."
                : "Connect a wallet to take live actions."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/agreements" className={buttonStyles({ variant: "secondary" })}>
            View agreements
          </Link>
          <Link href="/agreements/new" className={buttonStyles({ variant: "primary" })}>
            <FilePlus2 className="h-4 w-4" />
            Create agreement
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Active agreements"
          value={active.length}
          detail={`${funded.length} funded in total`}
          icon={<FilePlus2 className="h-4 w-4" />}
        />
        <Stat
          label={state.mode === "demo" ? "Demo funds in escrow" : "Test funds in escrow"}
          value={formatTokenAmount(escrow, 6)}
          detail={`${state.mode === "demo" ? "Simulated" : "Testnet"} USDC across active milestones`}
          icon={<CircleDollarSign className="h-4 w-4" />}
          tone="success"
        />
        <Stat
          label="Awaiting approval"
          value={awaiting.length}
          detail={awaiting.length ? "Milestones with evidence to review" : "No reviews outstanding"}
          icon={<Clock3 className="h-4 w-4" />}
          tone={awaiting.length ? "warning" : "default"}
        />
        <Stat
          label="Disputed milestones"
          value={disputed.length}
          detail={disputed.length ? "Funds locked pending arbitration" : "No open disputes"}
          icon={<Gavel className="h-4 w-4" />}
          tone={disputed.length ? "danger" : "default"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Card>
          <CardHeader
            title="Recent agreements"
            description="Settlement state, counterparties, and the next milestone."
            action={
              <Link
                href="/agreements"
                className="flex items-center gap-1 text-[0.7rem] font-semibold text-forest-700 hover:text-forest-900"
              >
                All agreements <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          <AgreementTable
            agreements={recent}
            compact
            emptyTitle={state.mode === "demo" ? "Demo records are missing" : "No live agreements yet"}
            emptyDescription={
              state.mode === "demo"
                ? "Reset the demo workspace in settings to restore the sample agreements."
                : "Create an agreement in live mode and deploy or connect to a configured escrow."
            }
            emptyAction={
              <Link href="/agreements/new" className={buttonStyles({ size: "sm" })}>
                Create agreement
              </Link>
            }
          />
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Needs attention"
              description="Actions that keep a milestone moving."
            />
            {needsAttention.length === 0 ? (
              <div className="px-5 py-8 text-center text-[0.78rem] text-ink-mute">
                Nothing is blocked. Every active milestone is on track.
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {needsAttention.map((agreement) => {
                  const status = deriveAgreementStatus(agreement);
                  const milestone = nextMilestone(agreement);
                  const role =
                    agreement.mode === "live" ? roleForAddress(agreement, address) : state.demoActor;
                  return (
                    <li key={agreement.id}>
                      <Link
                        href={`/agreements/${agreement.id}`}
                        className="group block px-5 py-3.5 transition-colors hover:bg-ink/[0.018]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[0.78rem] font-semibold text-ink group-hover:text-forest-800">
                              {agreement.title}
                            </p>
                            <p className="mt-0.5 text-[0.68rem] text-ink-mute">
                              {status === "disputed"
                                ? "Arbitrator action required"
                                : status === "awaiting_approval"
                                  ? "Evidence is waiting for payer review"
                                  : "Escrow is not funded yet"}
                              {milestone ? ` · ${milestone.description}` : ""}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <AgreementStatusBadge status={status} />
                            <p className="mt-1.5 text-[0.62rem] text-ink-faint">
                              {relativeTime(agreement.updatedAt)}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2.5 flex items-center gap-2">
                          <ProgressBar
                            value={
                              (agreement.milestones.filter((m) =>
                                ["released", "resolved", "refunded"].includes(m.status),
                              ).length /
                                Math.max(agreement.milestones.length, 1)) *
                              100
                            }
                            className="flex-1"
                          />
                          <span className="flex shrink-0 items-center gap-1 text-[0.62rem] font-semibold text-forest-700">
                            {role ? "Open" : "View"} <ArrowUpRight className="h-3 w-3" />
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <div className="rounded-2xl border border-line bg-forest-900 p-5 text-white">
            <div className="flex items-center gap-2 text-[0.66rem] font-bold uppercase tracking-[0.13em] text-white/55">
              <FlaskConical className="h-3.5 w-3.5" />
              {state.mode === "demo" ? "Demo workspace" : "Live testnet"}
            </div>
            <p className="mt-3 font-serif text-[1.3rem] leading-snug">
              {state.mode === "demo"
                ? "The full lifecycle is available without a wallet or API key."
                : "Wallet-authorized escrow, with every transaction inspectable."}
            </p>
            <p className="mt-2 text-[0.72rem] leading-relaxed text-white/65">
              {state.mode === "demo"
                ? "Switch roles in the sidebar to act as payer, payee, or arbitrator. Demo events are never presented as on-chain transactions."
                : "Use Base Sepolia or a local Anvil chain. PactRail never moves real funds and never silently switches networks."}
            </p>
            <Link
              href={state.mode === "demo" ? "/agreements/agr_website_redesign" : "/settings"}
              className="mt-4 inline-flex items-center gap-1.5 text-[0.72rem] font-semibold text-white/85 underline decoration-white/25 underline-offset-4 hover:text-white"
            >
              {state.mode === "demo" ? "Open the sample agreement" : "Network configuration"}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader
          title="How PactRail works"
          description="Agreement to settlement, with explicit human approval at the boundary."
        />
        <div className="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
          {HOW_IT_WORKS.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="px-5 py-5 sm:border-b sm:border-line lg:border-b-0">
                <div className="flex items-center justify-between">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-canvas text-forest-700">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="font-serif text-[1.1rem] text-ink-faint/70">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-3 text-[0.92rem] text-ink">{step.title}</h3>
                <p className="mt-1 text-[0.7rem] leading-relaxed text-ink-mute">{step.body}</p>
              </div>
            );
          })}
        </div>
      </Card>

      {state.mode === "live" && agreements.length === 0 ? (
        <EmptyState
          icon={<WalletCards className="h-5 w-5" />}
          title="Live workspace is empty"
          description="Configure a test network and create an agreement with your wallet. Or switch back to the demo workspace for the complete sample journey."
          action={
            <Link href="/settings" className={buttonStyles()}>
              Configure network
            </Link>
          }
        />
      ) : null}
    </div>
  );
}
