"use client";

import Link from "next/link";
import { ArrowUpRight, ChevronRight, FileText } from "lucide-react";
import type { Agreement } from "@/lib/types";
import { AgreementStatusBadge, DemoBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/primitives";
import { cn, formatDate, formatTokenAmount, relativeTime } from "@/lib/utils";
import { deriveAgreementStatus, nextMilestone } from "@/lib/agreement/status";
import { usePactRail } from "@/lib/store/pactrail-store";
import { roleForAddress } from "@/lib/agreement/permissions";
import { useAccount } from "wagmi";

function counterparty(agreement: Agreement): string {
  return agreement.payee.name || agreement.payer.name;
}

function rowContext(agreement: Agreement): string {
  return `${agreement.payer.name} → ${agreement.payee.name}`;
}

export function AgreementTable({
  agreements,
  emptyAction,
  emptyTitle = "No agreements yet",
  emptyDescription = "Create an agreement to turn reviewed terms into a milestone escrow.",
  compact = false,
}: {
  agreements: Agreement[];
  emptyAction?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  compact?: boolean;
}) {
  const { state } = usePactRail();
  const { address } = useAccount();

  if (agreements.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="h-5 w-5" />}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <div>
      <div className="hidden overflow-hidden md:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line text-[0.62rem] font-bold uppercase tracking-[0.12em] text-ink-faint">
              <th className={cn("px-5 py-3 font-bold lg:px-6", compact ? "min-w-[210px]" : "min-w-[220px]")}>
                Agreement
              </th>
              <th className="px-3 py-3 font-bold">Counterparty</th>
              <th className="px-3 py-3 text-right font-bold">Value</th>
              {!compact ? <th className="px-3 py-3 font-bold">Status</th> : null}
              <th className="px-3 py-3 font-bold">Next milestone</th>
              {!compact ? <th className="px-3 py-3 font-bold">Updated</th> : null}
              <th className="w-10 px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {agreements.map((agreement) => {
              const status = deriveAgreementStatus(agreement);
              const milestone = nextMilestone(agreement);
              const role =
                agreement.mode === "live"
                  ? roleForAddress(agreement, address)
                  : state.demoActor;
              const other =
                role === "payee"
                  ? agreement.payer.name
                  : role === "arbitrator"
                    ? `${agreement.payer.name} / ${agreement.payee.name}`
                    : counterparty(agreement);
              return (
                <tr
                  key={agreement.id}
                  className="group relative border-b border-line/80 transition-colors last:border-0 hover:bg-ink/[0.018]"
                >
                  <td className="px-5 py-3.5 lg:px-6">
                    <Link
                      href={`/agreements/${agreement.id}`}
                      className="block outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-forest-600"
                    >
                      <span className="flex items-center gap-2">
                        <span className="line-clamp-1 text-[0.82rem] font-semibold text-ink group-hover:text-forest-800">
                          {agreement.title}
                        </span>
                        {agreement.sample ? <DemoBadge /> : null}
                        {compact ? <AgreementStatusBadge status={status} /> : null}
                      </span>
                      <span className="mt-0.5 block truncate text-[0.68rem] text-ink-faint">
                        {agreement.mode === "demo" ? "Demo record" : "On-chain record"} ·{" "}
                        {formatDate(agreement.createdAt)}
                      </span>
                    </Link>
                  </td>
                  <td className="max-w-[170px] px-3 py-3.5">
                    <span className="block truncate text-[0.76rem] font-medium text-ink-soft">
                      {other}
                    </span>
                    <span className="mt-0.5 block text-[0.64rem] capitalize text-ink-faint">
                      {role ? `You are ${role}` : "Observer"}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-right">
                    <span className="tabular block text-[0.8rem] font-semibold text-ink">
                      {formatTokenAmount(agreement.totalAmountBaseUnits, agreement.token.decimals)}
                    </span>
                    <span className="mt-0.5 block text-[0.62rem] text-ink-faint">
                      {agreement.token.symbol}
                    </span>
                  </td>
                  {!compact ? (
                    <td className="px-3 py-3.5">
                      <AgreementStatusBadge status={status} />
                    </td>
                  ) : null}
                  <td className="max-w-[190px] px-3 py-3.5">
                    <span className="block truncate text-[0.74rem] text-ink-soft">
                      {milestone?.description ?? "—"}
                    </span>
                    <span className="mt-0.5 block text-[0.64rem] text-ink-faint">
                      {milestone ? `Due ${formatDate(milestone.dueAt)}` : "All settled"}
                    </span>
                  </td>
                  {!compact ? (
                    <td className="whitespace-nowrap px-3 py-3.5 text-[0.7rem] text-ink-mute">
                      {relativeTime(agreement.updatedAt)}
                    </td>
                  ) : null}
                  <td className="px-3 py-3.5 text-right">
                    <ChevronRight className="ml-auto h-4 w-4 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink-soft" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-line md:hidden">
        {agreements.map((agreement) => {
          const status = deriveAgreementStatus(agreement);
          const milestone = nextMilestone(agreement);
          return (
            <Link
              key={agreement.id}
              href={`/agreements/${agreement.id}`}
              className="block px-4 py-4 transition-colors hover:bg-ink/[0.018]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[0.84rem] font-semibold text-ink">{agreement.title}</span>
                    {agreement.sample ? <DemoBadge /> : null}
                  </div>
                  <p className="mt-0.5 truncate text-[0.68rem] text-ink-mute">
                    {rowContext(agreement)}
                  </p>
                </div>
                <AgreementStatusBadge status={status} />
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <p className="tabular text-[0.85rem] font-semibold text-ink">
                    {formatTokenAmount(agreement.totalAmountBaseUnits, agreement.token.decimals)}{" "}
                    <span className="text-[0.65rem] font-medium text-ink-faint">
                      {agreement.token.symbol}
                    </span>
                  </p>
                  <p className="mt-1 text-[0.68rem] text-ink-mute">
                    {milestone
                      ? `${milestone.description} · due ${formatDate(milestone.dueAt)}`
                      : "All milestones settled"}
                  </p>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-faint" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
