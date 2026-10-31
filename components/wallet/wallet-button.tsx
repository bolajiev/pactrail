"use client";

import * as React from "react";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { Check, ChevronDown, Copy, ExternalLink, LogOut, Wallet } from "lucide-react";
import { cn, shortAddress } from "@/lib/utils";
import { networkFor, addressExplorerUrl, liveNetworkOptions } from "@/lib/chain/config";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function WalletButton({ compact = false }: { compact?: boolean }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connectors, connectAsync, isPending } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const { disconnect } = useDisconnect();
  const { pushToast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [switching, setSwitching] = React.useState<number | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  async function handleConnect() {
    const hasProvider = Boolean((window as unknown as { ethereum?: unknown }).ethereum);
    if (!hasProvider) {
      pushToast({
        title: "No injected wallet detected",
        description:
          "Install a browser wallet such as MetaMask, or continue in the fully functional demo workspace.",
        tone: "warning",
        duration: 8000,
      });
      return;
    }
    const connector = connectors.find((item) => item.id === "injected") ?? connectors[0];
    if (!connector) {
      pushToast({ title: "No wallet connector available", tone: "error" });
      return;
    }
    try {
      await connectAsync({ connector });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Wallet connection failed.";
      pushToast({
        title: "Wallet connection not completed",
        description: message.split("\n")[0].slice(0, 180),
        tone: "error",
      });
    }
  }

  if (!isConnected || !address) {
    return (
      <Button
        variant="secondary"
        size={compact ? "sm" : "md"}
        onClick={handleConnect}
        loading={isPending}
        loadingText="Connecting"
        className={compact ? "px-2.5" : undefined}
      >
        <Wallet className="h-3.5 w-3.5" />
        <span className={compact ? "sr-only sm:not-sr-only" : undefined}>Connect wallet</span>
      </Button>
    );
  }

  const network = networkFor(chainId);
  const unsupported = !network;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "flex h-9 items-center gap-2 rounded-xl border border-line-strong bg-raised px-2.5 text-[0.76rem] font-semibold text-ink transition-colors hover:border-ink/30",
        )}
      >
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            unsupported ? "bg-danger-500" : "bg-success-500",
          )}
          aria-hidden
        />
        <span className="tabular hidden sm:inline">{shortAddress(address)}</span>
        <span className="hidden text-ink-faint lg:inline">·</span>
        <span className={cn("hidden lg:inline", unsupported && "text-danger-600")}>
          {network?.shortLabel ?? `Chain ${chainId}`}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-ink-mute" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-11 z-40 w-72 animate-dialog-in rounded-xl border border-line bg-raised p-2 shadow-lift"
        >
          <div className="rounded-lg bg-canvas/60 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[0.66rem] font-bold uppercase tracking-[0.12em] text-ink-faint">
                Connected account
              </span>
              <span
                className={cn(
                  "flex items-center gap-1 text-[0.66rem] font-semibold",
                  unsupported ? "text-danger-600" : "text-success-700",
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {unsupported ? "Unsupported" : "Connected"}
              </span>
            </div>
            <div className="mt-1 font-mono text-[0.72rem] text-ink">
              {shortAddress(address, 6)}
            </div>
            <div className="mt-0.5 text-[0.7rem] text-ink-mute">
              {network?.label ?? `Unsupported chain ${chainId}`}
            </div>
          </div>

          <div className="mt-1 space-y-0.5">
            <button
              type="button"
              role="menuitem"
              onClick={async () => {
                await navigator.clipboard.writeText(address);
                pushToast({ title: "Address copied", tone: "success", duration: 2500 });
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[0.76rem] text-ink-soft hover:bg-ink/[0.04]"
            >
              <Copy className="h-3.5 w-3.5 text-ink-faint" /> Copy address
            </button>
            {addressExplorerUrl(chainId, address) ? (
              <a
                role="menuitem"
                href={addressExplorerUrl(chainId, address)!}
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[0.76rem] text-ink-soft hover:bg-ink/[0.04]"
              >
                <ExternalLink className="h-3.5 w-3.5 text-ink-faint" /> View on explorer
              </a>
            ) : null}
          </div>

          <div className="my-1.5 h-px bg-line" />
          <p className="px-2.5 pb-1 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-ink-faint">
            Switch network
          </p>
          {liveNetworkOptions().map((option) => {
            const active = option.chain.id === chainId;
            const isConfigured = Boolean(option.escrowAddress);
            return (
              <button
                key={option.chain.id}
                type="button"
                role="menuitem"
                disabled={active || switching !== null}
                onClick={async () => {
                  setSwitching(option.chain.id);
                  try {
                    await switchChainAsync({ chainId: option.chain.id });
                    pushToast({
                      title: `Switched to ${option.label}`,
                      description: isConfigured
                        ? undefined
                        : "This network has no escrow address configured in this build.",
                      tone: isConfigured ? "success" : "warning",
                    });
                    setOpen(false);
                  } catch (error) {
                    pushToast({
                      title: "Network switch was not completed",
                      description:
                        error instanceof Error
                          ? error.message.split("\n")[0].slice(0, 180)
                          : undefined,
                      tone: "error",
                    });
                  } finally {
                    setSwitching(null);
                  }
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[0.76rem] text-ink-soft hover:bg-ink/[0.04] disabled:cursor-default disabled:hover:bg-transparent"
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      isConfigured ? "bg-forest-500" : "bg-clay-400",
                    )}
                  />
                  {option.label}
                </span>
                {active ? (
                  <span className="flex items-center gap-1 text-[0.66rem] font-semibold text-success-700">
                    <Check className="h-3 w-3" />
                    {switching === option.chain.id ? "Switching" : "Current"}
                  </span>
                ) : (
                  <span className="text-[0.64rem] text-ink-faint">
                    {isConfigured ? "Switch" : "Not configured"}
                  </span>
                )}
              </button>
            );
          })}

          <div className="my-1.5 h-px bg-line" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              disconnect();
              setOpen(false);
              pushToast({ title: "Wallet disconnected", tone: "info" });
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[0.76rem] text-danger-600 hover:bg-danger-50"
          >
            <LogOut className="h-3.5 w-3.5" /> Disconnect
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function ConnectWalletNotice({ message }: { message?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-canvas/50 px-3.5 py-2.5">
      <p className="text-[0.74rem] text-ink-mute">
        {message ?? "Connect a wallet on the agreement's network to use live actions."}
      </p>
      <WalletButton compact />
    </div>
  );
}
