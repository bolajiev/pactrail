"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  ChevronRight,
  FilePlus2,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Menu,
  RadioTower,
  Scale,
  ScrollText,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePactRail } from "@/lib/store/pactrail-store";
import { WalletButton } from "@/components/wallet/wallet-button";
import { useToast } from "@/components/ui/toast";
import { buttonStyles } from "@/components/ui/button";
import type { ActorRole, WorkspaceMode } from "@/lib/types";

const NAV = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/agreements", label: "Agreements", icon: FileText },
  { href: "/audit", label: "Audit trail", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

const ROLE_OPTIONS: Array<{ value: ActorRole; label: string }> = [
  { value: "payer", label: "Payer" },
  { value: "payee", label: "Payee" },
  { value: "arbitrator", label: "Arbitrator" },
];

function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect width="40" height="40" rx="11" fill="#173B30" />
      <path d="M10 15.5h20" stroke="#F1EEE6" strokeWidth="1.6" strokeLinecap="round" opacity="0.65" />
      <path d="M10 24.5h20" stroke="#F1EEE6" strokeWidth="1.6" strokeLinecap="round" opacity="0.65" />
      <path d="M20 10v20" stroke="#B9D3C2" strokeWidth="1.1" strokeLinecap="round" opacity="0.5" />
      <rect x="15.5" y="15.5" width="9" height="9" rx="2.2" fill="#FAF9F4" />
      <circle cx="20" cy="20" r="1.8" fill="#285C47" />
      <path d="M24.5 20h4" stroke="#FAF9F4" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M11.5 20h4" stroke="#FAF9F4" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function Brand() {
  return (
    <Link href="/overview" className="flex items-center gap-2.5 rounded-lg focus-visible:outline-offset-4">
      <BrandMark className="h-9 w-9 shadow-sm" />
      <span className="leading-none">
        <span className="block font-serif text-[1.28rem] font-medium tracking-[-0.02em] text-ink">
          PactRail
        </span>
        <span className="mt-1 block text-[0.58rem] font-bold uppercase tracking-[0.18em] text-ink-faint">
          Agreement settlement
        </span>
      </span>
    </Link>
  );
}

function ModeControl({ compact = false }: { compact?: boolean }) {
  const { state, setMode } = usePactRail();
  const { pushToast } = useToast();

  function change(mode: WorkspaceMode) {
    if (mode === state.mode) return;
    setMode(mode);
    pushToast({
      title: mode === "demo" ? "Demo workspace active" : "Live workspace active",
      description:
        mode === "demo"
          ? "Actions are simulated locally and never create blockchain transactions."
          : "Live actions require a connected wallet, a supported network, and configured escrow contracts.",
      tone: mode === "demo" ? "info" : "warning",
      duration: 6500,
    });
  }

  return (
    <div className={cn("grid grid-cols-2 rounded-lg border border-line bg-canvas/60 p-0.5", compact && "text-[0.7rem]")}>
      {(["demo", "live"] as WorkspaceMode[]).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => change(mode)}
          className={cn(
            "rounded-[0.4rem] px-2 py-1.5 text-[0.7rem] font-semibold capitalize transition-colors",
            state.mode === mode
              ? "bg-raised text-ink shadow-sm"
              : "text-ink-mute hover:text-ink",
          )}
          aria-pressed={state.mode === mode}
        >
          {mode}
        </button>
      ))}
    </div>
  );
}

function DemoRoleControl() {
  const { state, setDemoActor } = usePactRail();
  if (state.mode !== "demo") {
    return (
      <div className="rounded-xl border border-line bg-canvas/50 px-3 py-2.5">
        <p className="text-[0.64rem] font-bold uppercase tracking-[0.12em] text-ink-faint">
          Live authorization
        </p>
        <p className="mt-1 text-[0.7rem] leading-relaxed text-ink-mute">
          Actions are authorized by the connected wallet address.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[0.64rem] font-bold uppercase tracking-[0.12em] text-ink-faint">
          Demo role
        </p>
        <Scale className="h-3 w-3 text-ink-faint" />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1">
        {ROLE_OPTIONS.map((role) => (
          <button
            key={role.value}
            type="button"
            onClick={() => setDemoActor(role.value)}
            className={cn(
              "rounded-lg border px-1.5 py-1.5 text-[0.65rem] font-semibold transition-colors",
              state.demoActor === role.value
                ? "border-forest-700 bg-forest-800 text-white"
                : "border-line bg-raised text-ink-mute hover:border-ink/25 hover:text-ink",
            )}
            aria-pressed={state.demoActor === role.value}
          >
            {role.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[0.66rem] leading-relaxed text-ink-faint">
        Switch roles to exercise permissions. All actions are local demo events.
      </p>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { state } = usePactRail();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[73px] items-center justify-between border-b border-line px-5">
        <Brand />
      </div>

      <div className="px-4 pt-5">
        <Link
          href="/agreements/new"
          onClick={onNavigate}
          className={buttonStyles({ variant: "primary", className: "w-full justify-between group" })}
        >
          <span className="flex items-center gap-2">
            <FilePlus2 className="h-4 w-4" />
            Create agreement
          </span>
          <ChevronRight className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      <nav className="mt-6 px-3" aria-label="Primary navigation">
        <p className="px-2 pb-2 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-ink-faint">
          Workspace
        </p>
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href === "/agreements" &&
                pathname.startsWith("/agreements") &&
                pathname !== "/agreements/new");
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.8rem] font-medium transition-colors",
                    active
                      ? "bg-forest-800 text-white shadow-sm"
                      : "text-ink-soft hover:bg-ink/[0.045] hover:text-ink",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      active ? "text-white/80" : "text-ink-faint group-hover:text-ink-mute",
                    )}
                  />
                  {item.label}
                  {item.href === "/agreements" && active ? (
                    <span className="ml-auto rounded-full bg-white/15 px-1.5 py-0.5 text-[0.6rem] font-semibold">
                      {state.mode === "demo"
                        ? state.agreements.filter((a) => a.mode === "demo").length
                        : state.agreements.filter((a) => a.mode === "live").length}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto space-y-3 p-4">
        <div className="rounded-xl border border-line bg-surface p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {state.mode === "demo" ? (
                <FlaskConical className="h-3.5 w-3.5 text-clay-600" />
              ) : (
                <RadioTower className="h-3.5 w-3.5 text-navy-600" />
              )}
              <span className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-ink-faint">
                {state.mode === "demo" ? "Demo workspace" : "Live workspace"}
              </span>
            </div>
            <Link
              href="/settings"
              onClick={onNavigate}
              className="text-ink-faint transition-colors hover:text-ink"
              aria-label="Workspace settings"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-2.5">
            <ModeControl />
          </div>
          <div className="mt-3.5">
            <DemoRoleControl />
          </div>
        </div>
        <div className="flex items-start gap-2 px-1 text-[0.64rem] leading-relaxed text-ink-faint">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Testnet prototype. Test assets only. PactRail does not provide legal advice.
          </span>
        </div>
      </div>
    </div>
  );
}

function useSectionName(pathname: string): string {
  if (pathname === "/overview") return "Overview";
  if (pathname === "/agreements") return "Agreements";
  if (pathname === "/agreements/new") return "Create agreement";
  if (pathname.startsWith("/agreements/")) return "Agreement record";
  if (pathname === "/audit") return "Audit trail";
  if (pathname === "/settings") return "Settings";
  return "Workspace";
}

function ModeStrip() {
  const { state } = usePactRail();
  if (state.mode === "demo") {
    return (
      <div className="border-b border-clay-200/70 bg-clay-50">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6 lg:px-8">
          <p className="flex items-center gap-2 text-[0.7rem] font-medium text-clay-800">
            <FlaskConical className="h-3.5 w-3.5 shrink-0" />
            Demo workspace — actions are simulated locally and never create blockchain transactions.
          </p>
          <Link
            href="/settings"
            className="text-[0.68rem] font-bold text-clay-700 underline decoration-clay-300 underline-offset-2 hover:text-clay-900"
          >
            Workspace settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-navy-200/60 bg-navy-50">
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6 lg:px-8">
        <p className="flex items-center gap-2 text-[0.7rem] font-medium text-navy-800">
          <RadioTower className="h-3.5 w-3.5 shrink-0" />
          Live workspace — real testnet transactions with your connected wallet. Test assets only.
        </p>
        <Link
          href="/settings"
          className="text-[0.68rem] font-bold text-navy-700 underline decoration-navy-300 underline-offset-2 hover:text-navy-900"
        >
          Network settings
        </Link>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { state } = usePactRail();
  const section = useSectionName(pathname);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!mobileOpen) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen border-r border-line bg-surface lg:block">
        <SidebarContent />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-ink/35 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="relative h-full w-[290px] animate-dialog-in border-r border-line bg-surface shadow-lift">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-ink-mute hover:bg-ink/[0.05]"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur-sm">
          <div className="mx-auto flex h-[64px] max-w-[1320px] items-center justify-between gap-3 px-4 sm:px-6 lg:h-[73px] lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-raised text-ink-soft lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2 lg:hidden">
                <BrandMark className="h-8 w-8" />
              </div>
              <div className="hidden min-w-0 items-center gap-2 text-[0.74rem] lg:flex">
                <span className="font-semibold text-ink-faint">PactRail</span>
                <ChevronRight className="h-3 w-3 text-ink-faint/60" />
                <span className="truncate font-semibold text-ink">{section}</span>
              </div>
              <div className="min-w-0 text-[0.8rem] font-semibold text-ink lg:hidden">
                <span className="truncate">{section}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/settings"
                className="hidden items-center gap-1.5 rounded-full border border-line bg-raised px-2.5 py-1.5 text-[0.66rem] font-semibold text-ink-soft transition-colors hover:border-ink/25 sm:flex"
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    state.mode === "demo" ? "bg-clay-500" : "bg-navy-500",
                  )}
                />
                <span className="capitalize">{state.mode}</span> workspace
              </Link>
              <WalletButton compact />
            </div>
          </div>
        </header>

        <ModeStrip />

        <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
          {children}
        </main>

        <footer className="mx-auto flex w-full max-w-[1320px] flex-col gap-2 border-t border-line px-4 py-5 text-[0.66rem] text-ink-faint sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>PactRail — turn commercial agreements into verifiable milestone payments.</p>
          <p className="flex items-center gap-1.5">
            <Activity className="h-3 w-3" />
            Hackathon prototype · test assets only · not legal advice
          </p>
        </footer>
      </div>
    </div>
  );
}
