import { describe, expect, it } from "vitest";
import { createDemoStore } from "@/lib/demo/seed";
import {
  deriveAgreementStatus,
  fundedEscrowBaseUnits,
  nextActionLabel,
  nextMilestone,
  releasedBaseUnits,
} from "@/lib/agreement/status";
import { canPerform, roleForAddress } from "@/lib/agreement/permissions";
import type { Agreement } from "@/lib/types";

const store = createDemoStore();
const byTitle = (part: string): Agreement => {
  const agreement = store.agreements.find((item) => item.title.includes(part));
  if (!agreement) throw new Error(`Missing sample ${part}`);
  return agreement;
};

describe("agreement status derivation", () => {
  it("derives active, awaiting approval, disputed, and completed states", () => {
    expect(deriveAgreementStatus(byTitle("Website"))).toBe("active");
    expect(deriveAgreementStatus(byTitle("Brand"))).toBe("awaiting_approval");
    expect(deriveAgreementStatus(byTitle("Data migration"))).toBe("disputed");
    expect(deriveAgreementStatus(byTitle("content retainer"))).toBe("completed");
  });

  it("calculates escrow and release totals without floating point", () => {
    const website = byTitle("Website");
    expect(fundedEscrowBaseUnits(website)).toBe(4_000_000_000n);
    expect(releasedBaseUnits(website)).toBe(1_000_000_000n);
    expect(nextMilestone(website)?.description).toBe("Frontend implementation");
    expect(nextActionLabel(website)).toBe("Evidence due");
  });
});

describe("role permissions", () => {
  it("maps wallet addresses to roles", () => {
    const agreement: Agreement = {
      ...byTitle("Website"),
      payer: { ...byTitle("Website").payer, address: "0x1111111111111111111111111111111111111111" },
      payee: { ...byTitle("Website").payee, address: "0x2222222222222222222222222222222222222222" },
      arbitrator: {
        ...byTitle("Website").arbitrator,
        address: "0x3333333333333333333333333333333333333333",
      },
    };
    expect(roleForAddress(agreement, "0x1111111111111111111111111111111111111111")).toBe("payer");
    expect(roleForAddress(agreement, "0x9999999999999999999999999999999999999999")).toBeNull();
  });

  it("enforces evidence, approval, dispute, and resolution roles", () => {
    const website = byTitle("Website");
    const pending = website.milestones[1];
    expect(canPerform(website, pending, "submit_evidence", "payee").allowed).toBe(true);
    expect(canPerform(website, pending, "submit_evidence", "payer").allowed).toBe(false);
    expect(canPerform(website, pending, "dispute", "payer").allowed).toBe(true);

    const brand = byTitle("Brand");
    const submitted = brand.milestones[1];
    expect(canPerform(brand, submitted, "approve", "payer").allowed).toBe(true);
    expect(canPerform(brand, submitted, "approve", "payee").allowed).toBe(false);

    const disputed = byTitle("Data migration").milestones[1];
    expect(canPerform(byTitle("Data migration"), disputed, "resolve", "arbitrator").allowed).toBe(
      true,
    );
    expect(canPerform(byTitle("Data migration"), disputed, "resolve", "payer").allowed).toBe(false);
    expect(canPerform(byTitle("Data migration"), disputed, "approve", "payer").allowed).toBe(false);
  });

  it("rejects actions before funding or after completion", () => {
    const website = byTitle("Website");
    const unfunded: Agreement = { ...website, fundedAt: undefined };
    expect(canPerform(unfunded, unfunded.milestones[1], "submit_evidence", "payee").allowed).toBe(
      false,
    );
    const completed = byTitle("content retainer");
    expect(canPerform(completed, completed.milestones[0], "dispute", "payer").allowed).toBe(false);
  });
});
