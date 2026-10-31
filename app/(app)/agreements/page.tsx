"use client";

import * as React from "react";
import Link from "next/link";
import { FilePlus2, Search, SlidersHorizontal, X } from "lucide-react";
import { useWorkspaceAgreements } from "@/lib/store/pactrail-store";
import { PageHeader, Card } from "@/components/ui/primitives";
import { AgreementTable } from "@/components/agreements/agreement-table";
import { buttonStyles } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { deriveAgreementStatus, AGREEMENT_STATUS_LABELS } from "@/lib/agreement/status";
import type { AgreementStatus } from "@/lib/types";

const FILTERS: Array<{ value: "all" | AgreementStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: AGREEMENT_STATUS_LABELS.draft },
  { value: "awaiting_funding", label: AGREEMENT_STATUS_LABELS.awaiting_funding },
  { value: "active", label: AGREEMENT_STATUS_LABELS.active },
  { value: "awaiting_approval", label: AGREEMENT_STATUS_LABELS.awaiting_approval },
  { value: "disputed", label: AGREEMENT_STATUS_LABELS.disputed },
  { value: "completed", label: AGREEMENT_STATUS_LABELS.completed },
];

export default function AgreementsPage() {
  const agreements = useWorkspaceAgreements();
  const [filter, setFilter] = React.useState<"all" | AgreementStatus>("all");
  const [query, setQuery] = React.useState("");

  const counts = React.useMemo(() => {
    const result: Record<string, number> = { all: agreements.length };
    for (const agreement of agreements) {
      const status = deriveAgreementStatus(agreement);
      result[status] = (result[status] ?? 0) + 1;
    }
    return result;
  }, [agreements]);

  const filtered = React.useMemo(() => {
    const search = query.trim().toLowerCase();
    return agreements
      .filter((agreement) => {
        if (filter !== "all" && deriveAgreementStatus(agreement) !== filter) return false;
        if (!search) return true;
        return [
          agreement.title,
          agreement.summary,
          agreement.payer.name,
          agreement.payee.name,
          agreement.arbitrator.name,
          agreement.jurisdictionContext,
          ...agreement.milestones.map((milestone) => milestone.description),
        ]
          .join(" ")
          .toLowerCase()
          .includes(search);
      })
      .sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
      );
  }, [agreements, filter, query]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settlement portfolio"
        title="Agreements"
        description="Every record starts with human-approved terms and resolves through milestone evidence, approval, or arbitration."
        action={
          <Link href="/agreements/new" className={buttonStyles({ variant: "primary" })}>
            <FilePlus2 className="h-4 w-4" />
            Create agreement
          </Link>
        }
      />

      <Card>
        <div className="border-b border-line px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
              {FILTERS.map((item) => {
                const count = counts[item.value] ?? 0;
                const active = filter === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setFilter(item.value)}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[0.72rem] font-semibold transition-colors",
                      active
                        ? "bg-ink text-white"
                        : "text-ink-mute hover:bg-ink/[0.045] hover:text-ink",
                    )}
                    aria-pressed={active}
                  >
                    {item.label}
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[0.58rem] tabular",
                        active ? "bg-white/15 text-white" : "bg-ink/[0.055] text-ink-mute",
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="relative lg:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search agreements"
                className="h-9 pl-8 pr-8 text-[0.78rem]"
                aria-label="Search agreements"
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
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-line bg-canvas text-ink-mute">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <h3 className="mt-4 text-lg text-ink">
              {agreements.length === 0 ? "No agreements in this workspace" : "No matching agreements"}
            </h3>
            <p className="mx-auto mt-1.5 max-w-md text-[0.78rem] leading-relaxed text-ink-mute">
              {agreements.length === 0
                ? "Create an agreement from your own text or load the sample master services agreement."
                : "Try clearing the status filter or search term."}
            </p>
            <div className="mt-5">
              {agreements.length === 0 ? (
                <Link href="/agreements/new" className={buttonStyles({ size: "sm" })}>
                  Create agreement
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setFilter("all");
                    setQuery("");
                  }}
                  className={buttonStyles({ size: "sm", variant: "secondary" })}
                >
                  Reset filters
                </button>
              )}
            </div>
          </div>
        ) : (
          <AgreementTable agreements={filtered} />
        )}
      </Card>

      <p className="px-1 text-[0.66rem] leading-relaxed text-ink-faint">
        Status is derived from milestone state: a submitted milestone moves an agreement to
        awaiting approval; a dispute locks the affected milestone until the named arbitrator
        resolves it.
      </p>
    </div>
  );
}
