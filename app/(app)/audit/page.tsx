"use client";

import * as React from "react";
import Link from "next/link";
import { Download, ExternalLink, FileSearch, Search, X } from "lucide-react";
import { usePactRail, useWorkspaceActivity } from "@/lib/store/pactrail-store";
import {
  PageHeader,
  Card,
  CopyButton,
  EmptyState,
} from "@/components/ui/primitives";
import { Badge, OriginBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { downloadTextFile, formatDateTime, truncateHash } from "@/lib/utils";
import { txExplorerUrl } from "@/lib/chain/config";
import type { ActivityEvent, ActivityKind, ActivityOrigin } from "@/lib/types";

const KIND_GROUPS: Array<{ value: string; label: string; kinds: ActivityKind[] }> = [
  { value: "all", label: "All events", kinds: [] },
  {
    value: "terms",
    label: "Terms",
    kinds: ["terms_confirmed", "agreement_created", "draft_saved"],
  },
  { value: "funding", label: "Funding", kinds: ["funded", "refund_issued"] },
  {
    value: "evidence",
    label: "Evidence",
    kinds: ["evidence_submitted", "evidence_verified"],
  },
  { value: "settlement", label: "Settlement", kinds: ["milestone_approved", "agreement_completed"] },
  { value: "disputes", label: "Disputes", kinds: ["dispute_raised", "dispute_resolved"] },
];

const ORIGINS: Array<{ value: "all" | ActivityOrigin; label: string }> = [
  { value: "all", label: "All origins" },
  { value: "onchain", label: "On-chain" },
  { value: "demo", label: "Demo" },
  { value: "offchain", label: "Off-chain" },
];

function csvEscape(value: unknown): string {
  const text = value === undefined || value === null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows: ActivityEvent[], titles: Record<string, string>): string {
  const header = [
    "timestamp",
    "agreement_id",
    "agreement_title",
    "mode",
    "event",
    "actor",
    "origin",
    "summary",
    "transaction_hash",
    "reference_hash",
    "block_number",
  ];
  const body = rows.map((event) =>
    [
      event.at,
      event.agreementId,
      titles[event.agreementId] ?? "",
      event.mode,
      event.kind,
      event.actorLabel,
      event.origin,
      event.summary,
      event.txHash ?? "",
      event.hashRef ?? "",
      event.blockNumber ?? "",
    ]
      .map(csvEscape)
      .join(","),
  );
  return [header.join(","), ...body].join("\n");
}

export default function AuditPage() {
  const { state } = usePactRail();
  const events = useWorkspaceActivity();
  const [query, setQuery] = React.useState("");
  const [kind, setKind] = React.useState("all");
  const [origin, setOrigin] = React.useState<"all" | ActivityOrigin>("all");
  const [agreementId, setAgreementId] = React.useState("all");

  const titles = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const agreement of state.agreements) map[agreement.id] = agreement.title;
    return map;
  }, [state.agreements]);

  const workspaceAgreements = state.agreements.filter((agreement) => agreement.mode === state.mode);

  const filtered = React.useMemo(() => {
    const search = query.trim().toLowerCase();
    const kindGroup = KIND_GROUPS.find((group) => group.value === kind);
    return [...events]
      .filter((event) => {
        if (kindGroup && kindGroup.kinds.length > 0 && !kindGroup.kinds.includes(event.kind)) {
          return false;
        }
        if (origin !== "all" && event.origin !== origin) return false;
        if (agreementId !== "all" && event.agreementId !== agreementId) return false;
        if (!search) return true;
        return [
          titles[event.agreementId] ?? "",
          event.summary,
          event.actorLabel,
          event.detail ?? "",
          event.txHash ?? "",
          event.hashRef ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(search);
      })
      .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime());
  }, [events, query, kind, origin, agreementId, titles]);

  const counts = React.useMemo(
    () => ({
      total: events.length,
      onchain: events.filter((event) => event.origin === "onchain").length,
      demo: events.filter((event) => event.origin === "demo").length,
      offchain: events.filter((event) => event.origin === "offchain").length,
    }),
    [events],
  );

  function exportJson() {
    downloadTextFile(
      `pactrail-audit-${state.mode}-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          workspace: state.mode,
          note: "Demo events and off-chain records are not blockchain transactions.",
          events: filtered,
        },
        null,
        2,
      ),
      "application/json",
    );
  }

  function exportCsv() {
    downloadTextFile(
      `pactrail-audit-${state.mode}-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(filtered, titles),
      "text/csv",
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Verifiable history"
        title="Audit trail"
        description="A chronological record of terms approval, funding, evidence, release, and dispute decisions. On-chain, demo, and off-chain origins are distinct."
        action={
          <>
            <Button variant="secondary" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button onClick={exportJson} disabled={filtered.length === 0}>
              <Download className="h-3.5 w-3.5" /> Export JSON
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Recorded events", value: counts.total },
          { label: "On-chain", value: counts.onchain },
          { label: "Demo events", value: counts.demo },
          { label: "Off-chain records", value: counts.offchain },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-line bg-surface px-4 py-3">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.11em] text-ink-faint">
              {item.label}
            </p>
            <p className="tabular mt-1 font-serif text-[1.45rem] text-ink">{item.value}</p>
          </div>
        ))}
      </div>

      <Card>
        <div className="border-b border-line p-4 sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_170px_160px_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search events, actors, hashes, agreements"
                className="h-9 pl-8 pr-8 text-[0.78rem]"
                aria-label="Search audit events"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-faint hover:text-ink"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <Select
              value={kind}
              onChange={(event) => setKind(event.target.value)}
              className="h-9 text-[0.76rem]"
              aria-label="Filter by event type"
            >
              {KIND_GROUPS.map((group) => (
                <option key={group.value} value={group.value}>
                  {group.label}
                </option>
              ))}
            </Select>
            <Select
              value={origin}
              onChange={(event) => setOrigin(event.target.value as "all" | ActivityOrigin)}
              className="h-9 text-[0.76rem]"
              aria-label="Filter by origin"
            >
              {ORIGINS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
            <Select
              value={agreementId}
              onChange={(event) => setAgreementId(event.target.value)}
              className="h-9 text-[0.76rem]"
              aria-label="Filter by agreement"
            >
              <option value="all">All agreements</option>
              {workspaceAgreements.map((agreement) => (
                <option key={agreement.id} value={agreement.id}>
                  {agreement.title}
                </option>
              ))}
            </Select>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.66rem] text-ink-faint">
            <span>
              Showing {filtered.length} of {events.length} events
            </span>
            <span aria-hidden>·</span>
            <span>
              Demo actions never create hashes or transactions. Explorer links appear only for
              configured public testnets.
            </span>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<FileSearch className="h-5 w-5" />}
              title="No matching audit events"
              description="Adjust the filters, or create and fund an agreement to start recording activity."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setQuery("");
                    setKind("all");
                    setOrigin("all");
                    setAgreementId("all");
                  }}
                >
                  Reset filters
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-[0.6rem] font-bold uppercase tracking-[0.11em] text-ink-faint">
                  <th className="px-5 py-3 font-bold">Time</th>
                  <th className="px-3 py-3 font-bold">Agreement</th>
                  <th className="px-3 py-3 font-bold">Event</th>
                  <th className="px-3 py-3 font-bold">Actor</th>
                  <th className="px-3 py-3 font-bold">Origin</th>
                  <th className="px-3 py-3 font-bold">Reference</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((event) => {
                  const href = txExplorerUrl(event.chainId, event.txHash);
                  return (
                    <tr
                      key={event.id}
                      className="border-b border-line/70 align-top transition-colors last:border-0 hover:bg-ink/[0.018]"
                    >
                      <td className="whitespace-nowrap px-5 py-3.5 text-[0.68rem] text-ink-mute">
                        {formatDateTime(event.at)}
                      </td>
                      <td className="max-w-[190px] px-3 py-3.5">
                        <Link
                          href={`/agreements/${event.agreementId}`}
                          className="line-clamp-2 text-[0.72rem] font-semibold text-ink hover:text-forest-800"
                        >
                          {titles[event.agreementId] ?? event.agreementId}
                        </Link>
                        <span className="mt-0.5 block text-[0.6rem] capitalize text-ink-faint">
                          {event.mode} workspace
                        </span>
                      </td>
                      <td className="max-w-[360px] px-3 py-3.5">
                        <p className="text-[0.72rem] leading-relaxed text-ink">{event.summary}</p>
                        {event.detail ? (
                          <p className="mt-0.5 line-clamp-2 text-[0.64rem] leading-relaxed text-ink-mute">
                            {event.detail}
                          </p>
                        ) : null}
                        <span className="mt-1 inline-block rounded bg-ink/[0.04] px-1.5 py-0.5 text-[0.56rem] font-semibold uppercase tracking-[0.06em] text-ink-mute">
                          {event.kind.replaceAll("_", " ")}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-[0.7rem] text-ink-soft">{event.actorLabel}</td>
                      <td className="px-3 py-3.5">
                        <OriginBadge origin={event.origin} />
                      </td>
                      <td className="max-w-[220px] px-3 py-3.5">
                        {event.txHash ? (
                          <div className="flex items-center gap-1.5">
                            <code className="font-mono text-[0.6rem] text-ink-mute" title={event.txHash}>
                              {truncateHash(event.txHash)}
                            </code>
                            <CopyButton value={event.txHash} label="" />
                            {href ? (
                              <a
                                href={href}
                                target="_blank"
                                rel="noreferrer"
                                className="text-forest-700 hover:text-forest-900"
                                aria-label="View transaction"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : null}
                          </div>
                        ) : event.hashRef ? (
                          <div className="flex items-center gap-1.5">
                            <code className="font-mono text-[0.6rem] text-ink-mute" title={event.hashRef}>
                              {truncateHash(event.hashRef)}
                            </code>
                            <CopyButton value={event.hashRef} label="" />
                          </div>
                        ) : (
                          <span className="text-[0.64rem] text-ink-faint">No chain reference</span>
                        )}
                        {event.blockNumber ? (
                          <p className="mt-1 text-[0.6rem] text-ink-faint">Block {event.blockNumber}</p>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="flex items-start gap-2 rounded-xl border border-clay-200 bg-clay-50 px-4 py-3 text-[0.68rem] leading-relaxed text-clay-800">
        <Badge tone="amber">Important</Badge>
        <span>
          A complete audit trail is not a legal opinion. Evidence hashes only verify byte-level
          matching, and demo or off-chain events are not blockchain transactions.
        </span>
      </div>
    </div>
  );
}
