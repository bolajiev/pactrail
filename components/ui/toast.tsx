"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Info, Loader2, X, XCircle } from "lucide-react";
import { cn, uid } from "@/lib/utils";

type Tone = "info" | "success" | "error" | "warning" | "pending";

export interface ToastInput {
  title: string;
  description?: string;
  tone?: Tone;
  duration?: number;
  action?: { label: string; href: string };
}

interface ToastItem extends ToastInput {
  id: string;
}

interface ToastContextValue {
  pushToast: (input: ToastInput) => string;
  updateToast: (id: string, patch: Partial<ToastInput>) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

const toneStyles: Record<Tone, string> = {
  info: "border-navy-200 text-navy-800",
  success: "border-success-200 text-success-800",
  error: "border-danger-200 text-danger-800",
  warning: "border-clay-200 text-clay-800",
  pending: "border-line-strong text-ink-soft",
};

const toneIcon: Record<Tone, React.ReactNode> = {
  info: <Info className="h-4 w-4 text-navy-600" />,
  success: <CheckCircle2 className="h-4 w-4 text-success-600" />,
  error: <XCircle className="h-4 w-4 text-danger-600" />,
  warning: <AlertTriangle className="h-4 w-4 text-clay-600" />,
  pending: <Loader2 className="h-4 w-4 animate-spin text-ink-mute" />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const timers = React.useRef<Record<string, number>>({});

  const dismissToast = React.useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    if (timers.current[id]) {
      window.clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const scheduleDismiss = React.useCallback(
    (id: string, duration: number) => {
      if (timers.current[id]) window.clearTimeout(timers.current[id]);
      if (duration > 0) {
        timers.current[id] = window.setTimeout(() => dismissToast(id), duration);
      }
    },
    [dismissToast],
  );

  const pushToast = React.useCallback(
    (input: ToastInput) => {
      const id = uid("toast");
      const item: ToastItem = { tone: "info", duration: 5200, ...input, id };
      setToasts((current) => [...current.slice(-3), item]);
      scheduleDismiss(id, input.duration ?? 5200);
      return id;
    },
    [scheduleDismiss],
  );

  const updateToast = React.useCallback(
    (id: string, patch: Partial<ToastInput>) => {
      setToasts((current) =>
        current.map((toast) => (toast.id === id ? { ...toast, ...patch } : toast)),
      );
      const duration = patch.duration ?? (patch.tone === "error" ? 9000 : 5200);
      scheduleDismiss(id, duration);
    },
    [scheduleDismiss],
  );

  React.useEffect(() => {
    const timerMap = timers.current;
    return () => {
      Object.values(timerMap).forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const value = React.useMemo(
    () => ({ pushToast, updateToast, dismissToast }),
    [pushToast, updateToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto animate-toast-in rounded-xl border bg-raised p-3.5 shadow-lift",
              toneStyles[toast.tone ?? "info"],
            )}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">{toneIcon[toast.tone ?? "info"]}</div>
              <div className="min-w-0 flex-1">
                <p className="text-[0.8rem] font-semibold text-ink">{toast.title}</p>
                {toast.description ? (
                  <p className="mt-1 break-words text-[0.72rem] leading-relaxed text-ink-mute">
                    {toast.description}
                  </p>
                ) : null}
                {toast.action ? (
                  <a
                    href={toast.action.href}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-[0.7rem] font-semibold text-forest-700 hover:text-forest-900"
                  >
                    {toast.action.label} <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="shrink-0 rounded p-1 text-ink-faint transition-colors hover:text-ink"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider.");
  return context;
}
