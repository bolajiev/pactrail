"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-soft">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-danger-200 bg-danger-50 text-danger-600">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <h1 className="mt-4 text-2xl text-ink">Something interrupted this view.</h1>
        <p className="mt-2 text-[0.8rem] leading-relaxed text-ink-mute">
          No blockchain transaction was created by this error. Try again, or return to the
          overview.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-[0.62rem] text-ink-faint">Reference {error.digest}</p>
        ) : null}
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="secondary" onClick={() => reset()}>
            Try again
          </Button>
          <Button onClick={() => (window.location.href = "/overview")}>Overview</Button>
        </div>
      </div>
    </div>
  );
}
