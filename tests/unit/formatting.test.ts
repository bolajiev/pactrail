import { describe, expect, it } from "vitest";
import {
  dateAtUtcMidnight,
  formatTokenAmount,
  formatUnitsInput,
  parseAmountToBaseUnits,
} from "@/lib/utils";

describe("integer token amount handling", () => {
  it("formats base units at the UI boundary", () => {
    expect(formatTokenAmount("5000000000", 6)).toBe("$5,000.00");
    expect(formatTokenAmount("1200000", 6)).toBe("$1.20");
    expect(formatTokenAmount("1", 6)).toBe("$0.000001");
    expect(formatTokenAmount("123456789012345678", 6)).toBe("$123,456,789,012.345678");
    expect(formatTokenAmount(0n, 6)).toBe("$0.00");
  });

  it("parses decimal input into exact base units", () => {
    expect(parseAmountToBaseUnits("5,000.50", 6)).toEqual({ ok: true, value: "5000500000" });
    expect(parseAmountToBaseUnits("$1,000", 6)).toEqual({ ok: true, value: "1000000000" });
    expect(parseAmountToBaseUnits("0.123456", 6)).toEqual({ ok: true, value: "123456" });
    expect(parseAmountToBaseUnits("0.1234567", 6).ok).toBe(false);
    expect(parseAmountToBaseUnits("abc", 6).ok).toBe(false);
    expect(parseAmountToBaseUnits("-5", 6).ok).toBe(false);
  });

  it("round-trips base units for editing", () => {
    expect(formatUnitsInput("5000500000", 6)).toBe("5000.5");
    expect(formatUnitsInput("1000000", 6)).toBe("1");
  });

  it("normalizes date input to end of UTC day", () => {
    expect(dateAtUtcMidnight("2026-11-14")).toBe("2026-11-14T23:59:59.000Z");
  });
});
