"use client";

import { ExternalLink, FileText, Fingerprint, ShieldAlert } from "lucide-react";
import type { Agreement, Milestone } from "@/lib/types";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/primitives";
import { VerifyEvidence } from "@/components/evidence/verify-evidence";
import { formatDateTime, formatFileSize } from "@/lib/utils";

function safeExternalUri(uri?: string): string | null {
  if (!uri) return null;
  if (/^https?:\/\//i.test(uri) || /^ipfs:\/\//i.test(uri) || uri.startsWith("/demo/")) {
    return uri;
  }
  return null;
}

export function EvidenceDialog({
  open,
  onOpenChange,
  agreement,
  milestone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agreement: Agreement;
  milestone: Milestone;
}) {
  const evidence = milestone.evidence;
  if (!evidence) return null;
  const uri = safeExternalUri(evidence.uri);
  const isDemoArtifact = Boolean(uri?.startsWith("/demo/"));

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Evidence — ${milestone.description}`}
      description="Evidence metadata and hash recorded against this milestone."
      size="lg"
    >
      <div className="grid gap-5 md:grid-cols-[1.05fr_0.95fr]">
        <div>
          <div className="rounded-xl border border-line bg-canvas/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-raised text-ink-mute">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[0.8rem] font-semibold text-ink">
                    {evidence.fileName ?? "Evidence reference"}
                  </p>
                  <p className="mt-0.5 text-[0.68rem] text-ink-mute">
                    {evidence.fileName
                      ? `${formatFileSize(evidence.fileSize)} · ${evidence.mimeType ?? "file"}`
                      : "Hash reference only"}
                  </p>
                </div>
              </div>
              {agreement.mode === "demo" ? (
                <Badge tone="sand">Demo artifact</Badge>
              ) : (
                <Badge tone="blue">Hash on-chain</Badge>
              )}
            </div>
            <p className="mt-3 text-[0.76rem] leading-relaxed text-ink-soft">
              {evidence.description}
            </p>
            <dl className="mt-3 space-y-2 border-t border-line pt-3 text-[0.7rem]">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink-faint">Submitted by</dt>
                <dd className="text-right font-medium text-ink-soft">
                  {evidence.submittedByLabel}{" "}
                  <span className="capitalize text-ink-faint">({evidence.submittedByRole})</span>
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink-faint">Submitted at</dt>
                <dd className="text-right font-medium text-ink-soft">
                  {formatDateTime(evidence.submittedAt)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink-faint">Location</dt>
                <dd className="max-w-[65%] text-right">
                  {uri ? (
                    <a
                      href={uri}
                      target={isDemoArtifact ? undefined : "_blank"}
                      rel={isDemoArtifact ? undefined : "noreferrer"}
                      download={isDemoArtifact ? "" : undefined}
                      className="inline-flex items-center gap-1 break-all font-medium text-forest-700 hover:text-forest-900"
                    >
                      {isDemoArtifact ? "Download demo artifact" : evidence.uri}{" "}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  ) : (
                    <span className="text-ink-mute">
                      {agreement.mode === "live"
                        ? "Not hosted by PactRail"
                        : "Demo metadata only"}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-4 rounded-xl border border-line bg-raised p-4">
            <div className="flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-ink-mute" />
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.1em] text-ink-faint">
                SHA-256 evidence hash
              </p>
            </div>
            <code className="hash mt-2 block rounded-lg border border-line bg-canvas/50 p-2.5 text-ink-soft">
              {evidence.hash}
            </code>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-[0.64rem] leading-relaxed text-ink-faint">
                The hash binds these bytes to the milestone record.
              </p>
              <CopyButton value={evidence.hash} />
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-xl border border-clay-200 bg-clay-50 px-3.5 py-2.5 text-[0.68rem] leading-relaxed text-clay-800">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            A hash does not prove a document is truthful, complete, or legally sufficient. It only
            lets a reviewer check that bytes match the earlier artifact.
          </div>
        </div>

        <div>
          <p className="mb-2 text-[0.7rem] font-bold uppercase tracking-[0.1em] text-ink-faint">
            Reviewer check
          </p>
          <VerifyEvidence
            agreementId={agreement.id}
            milestoneId={milestone.id}
            expectedHash={evidence.hash}
            compact
          />
        </div>
      </div>
    </Dialog>
  );
}
