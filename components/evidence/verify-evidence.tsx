"use client";

import * as React from "react";
import { CheckCircle2, FileUp, Fingerprint, ShieldQuestion, XCircle } from "lucide-react";
import { usePactRail } from "@/lib/store/pactrail-store";
import { formatFileSize, cn } from "@/lib/utils";

type Result =
  | { status: "idle" }
  | { status: "hashing"; fileName: string }
  | { status: "match"; fileName: string; size: number; hash: string }
  | { status: "mismatch"; fileName: string; size: number; hash: string }
  | { status: "error"; message: string };

async function sha256File(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function VerifyEvidence({
  agreementId,
  milestoneId,
  expectedHash,
  compact = false,
}: {
  agreementId: string;
  milestoneId: string;
  expectedHash: string;
  compact?: boolean;
}) {
  const { recordEvidenceVerification } = usePactRail();
  const [result, setResult] = React.useState<Result>({ status: "idle" });
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const inputId = React.useId();

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setResult({ status: "hashing", fileName: file.name });
    try {
      const hash = await sha256File(file);
      const matched = hash.toLowerCase() === expectedHash.toLowerCase();
      setResult({
        status: matched ? "match" : "mismatch",
        fileName: file.name,
        size: file.size,
        hash,
      });
      recordEvidenceVerification(agreementId, milestoneId, matched, file.name);
    } catch {
      setResult({
        status: "error",
        message: "The file could not be read by this browser.",
      });
    }
  }

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void handleFile(event.dataTransfer.files?.[0]);
        }}
        className={cn(
          "rounded-xl border border-dashed px-4 py-5 text-center transition-colors",
          dragging ? "border-forest-500 bg-forest-50" : "border-line-strong bg-canvas/40",
          compact ? "py-4" : "py-6",
        )}
      >
        <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full border border-line bg-raised text-ink-mute">
          {result.status === "match" ? (
            <CheckCircle2 className="h-4 w-4 text-success-600" />
          ) : result.status === "mismatch" || result.status === "error" ? (
            <XCircle className="h-4 w-4 text-danger-500" />
          ) : (
            <Fingerprint className="h-4 w-4" />
          )}
        </div>
        <p className="mt-2.5 text-[0.78rem] font-semibold text-ink">
          {result.status === "hashing" ? "Computing SHA-256 in your browser…" : "Verify a local copy"}
        </p>
        <p className="mx-auto mt-1 max-w-sm text-[0.68rem] leading-relaxed text-ink-mute">
          Select the same file to recompute its SHA-256. The file stays in your browser and is
          never uploaded.
        </p>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="sr-only"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-raised px-3 py-1.5 text-[0.72rem] font-semibold text-ink-soft transition-colors hover:border-ink/30 hover:text-ink"
        >
          <FileUp className="h-3.5 w-3.5" />
          Choose file
        </button>
      </div>

      {result.status === "match" || result.status === "mismatch" ? (
        <div
          className={cn(
            "mt-3 rounded-xl border px-3.5 py-3",
            result.status === "match"
              ? "border-success-200 bg-success-50"
              : "border-danger-200 bg-danger-50",
          )}
          role="status"
        >
          <div className="flex items-start gap-2">
            {result.status === "match" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-600" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger-600" />
            )}
            <div className="min-w-0">
              <p
                className={cn(
                  "text-[0.76rem] font-semibold",
                  result.status === "match" ? "text-success-800" : "text-danger-800",
                )}
              >
                {result.status === "match"
                  ? "Hash matches the submitted evidence"
                  : "Hash does not match the submitted evidence"}
              </p>
              <p className="mt-0.5 break-all text-[0.68rem] leading-relaxed text-ink-mute">
                {result.fileName} · {formatFileSize(result.size)}
              </p>
              <p className="mt-1 break-all font-mono text-[0.64rem] text-ink-mute">
                {result.hash}
              </p>
              <p className="mt-1.5 text-[0.64rem] leading-relaxed text-ink-faint">
                A matching hash confirms the bytes match the earlier artifact. It does not prove
                the document is accurate or legally sufficient.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {result.status === "error" ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-danger-200 bg-danger-50 px-3.5 py-3 text-[0.72rem] text-danger-700">
          <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0" />
          {result.message}
        </div>
      ) : null}
    </div>
  );
}
