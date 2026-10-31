import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-soft">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-ink-faint">
          PactRail
        </p>
        <h1 className="mt-3 text-3xl text-ink">This record is not on the rail.</h1>
        <p className="mt-2 text-[0.8rem] leading-relaxed text-ink-mute">
          The page or agreement you requested could not be found in this workspace.
        </p>
        <Link href="/overview" className={buttonStyles({ className: "mt-5" })}>
          Back to overview
        </Link>
      </div>
    </div>
  );
}
