import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { parseUnits } from "viem";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(prefix = "id"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function shortAddress(address?: string | null, chars = 4): string {
  if (!address) return "Not connected";
  return `${address.slice(0, 2 + chars)}…${address.slice(-chars)}`;
}

export function groupInteger(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export interface FormatAmountOptions {
  symbol?: string;
  minimumFractionDigits?: number;
  maxFractionDigits?: number;
}

export function formatTokenAmount(
  baseUnits: string | bigint,
  decimals = 6,
  options: FormatAmountOptions = {},
): string {
  const { symbol = "$", minimumFractionDigits = 2, maxFractionDigits = 6 } = options;
  let value = typeof baseUnits === "bigint" ? baseUnits : BigInt(baseUnits || "0");
  const negative = value < 0n;
  if (negative) value = -value;

  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const fraction = value % divisor;

  let fractionText = fraction.toString().padStart(decimals, "0").slice(0, maxFractionDigits);
  fractionText = fractionText.replace(/0+$/, "");
  if (fractionText.length < minimumFractionDigits) {
    fractionText = fractionText.padEnd(minimumFractionDigits, "0");
  }

  const wholeText = groupInteger(whole.toString());
  return `${negative ? "-" : ""}${symbol}${wholeText}${fractionText ? `.${fractionText}` : ""}`;
}

export function formatUnitsInput(baseUnits: string, decimals = 6): string {
  const divider = 10n ** BigInt(decimals);
  const value = BigInt(baseUnits || "0");
  const whole = value / divider;
  const fraction = value % divider;
  if (fraction === 0n) return whole.toString();
  return `${whole}.${fraction.toString().padStart(decimals, "0").replace(/0+$/, "")}`;
}

export function parseAmountToBaseUnits(
  input: string,
  decimals = 6,
): { ok: true; value: string } | { ok: false; error: string } {
  const clean = input.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d+)?$/.test(clean)) {
    return { ok: false, error: "Enter a valid amount." };
  }
  const fraction = clean.split(".")[1] ?? "";
  if (fraction.length > decimals) {
    return { ok: false, error: `Use no more than ${decimals} decimal places.` };
  }
  try {
    return { ok: true, value: parseUnits(clean, decimals).toString() };
  } catch {
    return { ok: false, error: "Enter a valid amount." };
  }
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return DATE_FORMAT.format(date);
}

export function formatMonthDay(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return MONTH_FORMAT.format(date);
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return `${DATE_TIME_FORMAT.format(date)} UTC`;
}

export function toDateInput(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function dateAtUtcMidnight(value: string): string {
  if (!value) return "";
  return new Date(`${value}T23:59:59.000Z`).toISOString();
}

export function daysFromNow(value: string): number {
  const date = new Date(value).getTime();
  if (Number.isNaN(date)) return 0;
  return Math.ceil((date - Date.now()) / 86_400_000);
}

export function relativeTime(value: string): string {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "—";
  const diff = timestamp - Date.now();
  const abs = Math.abs(diff);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000_000],
    ["month", 2_592_000_000],
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === "minute") {
      return formatter.format(Math.round(diff / ms), unit);
    }
  }
  return "just now";
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function truncateHash(hash?: string | null): string {
  if (!hash) return "—";
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}

export function explorerTxUrl(chainId: number, hash?: string): string | null {
  if (!hash) return null;
  if (chainId === 84532) return `https://sepolia.basescan.org/tx/${hash}`;
  if (chainId === 31337) return null;
  return null;
}

export function explorerAddressUrl(chainId: number, address?: string): string | null {
  if (!address) return null;
  if (chainId === 84532) return `https://sepolia.basescan.org/address/${address}`;
  return null;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function downloadTextFile(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
