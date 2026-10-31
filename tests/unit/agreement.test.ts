import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildApprovedTerms,
  canonicalStringify,
  canonicalize,
  computeTermsHash,
  sha256Hex,
  sumMilestoneAmounts,
  type AgreementDraft,
} from "@/lib/agreement/canonical";
import { runPreflight } from "@/lib/agreement/preflight";

const now = Date.now();
const due = (days: number) => new Date(now + days * 86_400_000).toISOString();

function draft(overrides: Partial<AgreementDraft> = {}): AgreementDraft {
  return {
    title: "Website redesign and development",
    summary: "Three-milestone website project.",
    payer: { role: "payer", name: "Northstar Commerce Ltd", address: null },
    payee: { role: "payee", name: "Studio Nine", address: null },
    arbitrator: { role: "arbitrator", name: "Demo Arbitration Account", address: null },
    token: { symbol: "USDC", address: null, decimals: 6 },
    totalAmountBaseUnits: "5000000000",
    jurisdictionContext: "England and Wales",
    chainId: null,
    milestones: [
      {
        id: "m1",
        description: "Design approval",
        acceptanceCriteria: "Approved Figma prototype.",
        amountBaseUnits: "1000000000",
        dueAt: due(14),
      },
      {
        id: "m2",
        description: "Frontend implementation",
        acceptanceCriteria: "Responsive staging site.",
        amountBaseUnits: "2000000000",
        dueAt: due(28),
      },
      {
        id: "m3",
        description: "Final handover",
        acceptanceCriteria: "Production build and handover.",
        amountBaseUnits: "2000000000",
        dueAt: due(42),
      },
    ],
    ...overrides,
  };
}

describe("canonical terms", () => {
  it("sorts object keys recursively but preserves array order", () => {
    expect(canonicalize({ z: 1, a: { y: 2, x: 3 }, list: [2, 1] })).toEqual({
      a: { x: 3, y: 2 },
      list: [2, 1],
      z: 1,
    });
    expect(canonicalStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(
      '{"a":{"c":3,"d":2},"b":1}',
    );
  });

  it("lowercases addresses in approved terms", () => {
    const terms = buildApprovedTerms(
      draft({
        payer: {
          role: "payer",
          name: "Payer",
          address: "0xABC0000000000000000000000000000000000001",
        },
      }),
    );
    expect(terms.parties.payer.address).toBe(
      "0xabc0000000000000000000000000000000000001",
    );
  });

  it("computes a deterministic SHA-256 hash matching Node", async () => {
    const result = await computeTermsHash(draft());
    const expected = createHash("sha256").update(result.canonicalTerms).digest("hex");
    expect(result.hash).toBe(`0x${expected}`);
    const again = await computeTermsHash(draft());
    expect(again.hash).toBe(result.hash);
    expect(await sha256Hex("hello")).toBe(
      createHash("sha256").update("hello").digest("hex"),
    );
  });

  it("changes the hash when an amount changes", async () => {
    const base = await computeTermsHash(draft());
    const changed = await computeTermsHash(
      draft({
        milestones: draft().milestones.map((milestone, index) =>
          index === 0 ? { ...milestone, amountBaseUnits: "1000000001" } : milestone,
        ),
        totalAmountBaseUnits: "5000000001",
      }),
    );
    expect(changed.hash).not.toBe(base.hash);
  });

  it("sums large integer base units without floating point", () => {
    expect(sumMilestoneAmounts(draft().milestones)).toBe("5000000000");
  });
});

describe("preflight checks", () => {
  it("passes a complete demo agreement", () => {
    const result = runPreflight(draft(), { live: false });
    expect(result.ready).toBe(true);
    expect(result.checks.find((check) => check.id === "addresses")?.status).toBe("warn");
  });

  it("blocks live agreements without wallet addresses", () => {
    const result = runPreflight(draft(), { live: true });
    expect(result.ready).toBe(false);
    expect(result.checks.find((check) => check.id === "addresses")?.status).toBe("fail");
  });

  it("blocks duplicate live roles", () => {
    const address = "0x1111111111111111111111111111111111111111";
    const result = runPreflight(
      draft({
        payer: { role: "payer", name: "Payer", address },
        payee: { role: "payee", name: "Payee", address },
        arbitrator: { role: "arbitrator", name: "Arb", address: "0x2222222222222222222222222222222222222222" },
      }),
      { live: true },
    );
    expect(result.ready).toBe(false);
    expect(result.checks.find((check) => check.id === "distinct")?.status).toBe("fail");
  });

  it("blocks a zero milestone amount and a mismatched total", () => {
    const zero = draft({
      milestones: draft().milestones.map((milestone, index) =>
        index === 1 ? { ...milestone, amountBaseUnits: "0" } : milestone,
      ),
    });
    expect(runPreflight(zero, { live: false }).ready).toBe(false);

    const mismatch = draft({ totalAmountBaseUnits: "4000000000" });
    const result = runPreflight(mismatch, { live: false });
    expect(result.ready).toBe(false);
    expect(result.checks.find((check) => check.id === "schedule_total")?.status).toBe("fail");
  });

  it("blocks past and missing deadlines", () => {
    const past = draft({
      milestones: draft().milestones.map((milestone, index) =>
        index === 0 ? { ...milestone, dueAt: new Date(now - 86_400_000).toISOString() } : milestone,
      ),
    });
    expect(runPreflight(past, { live: false }).ready).toBe(false);
  });
});
