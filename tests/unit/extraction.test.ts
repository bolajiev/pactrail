import { describe, expect, it } from "vitest";
import { extractAgreementWithRules } from "@/lib/ai/rules";
import { agreementAnalysisSchema } from "@/lib/ai/schema";
import { SAMPLE_AGREEMENT_TEXT } from "@/lib/demo/sample-agreement";

describe("rules-based agreement extraction", () => {
  it("extracts the sample agreement into a schema-valid proposal", () => {
    const analysis = extractAgreementWithRules(SAMPLE_AGREEMENT_TEXT);
    expect(() => agreementAnalysisSchema.parse(analysis)).not.toThrow();
    expect(analysis.title.value).toBe("Website redesign and development");
    expect(analysis.parties.find((party) => party.role === "payer")?.name).toBe(
      "Northstar Commerce Ltd",
    );
    expect(analysis.parties.find((party) => party.role === "payee")?.name).toBe("Studio Nine");
    expect(analysis.parties.find((party) => party.role === "arbitrator")?.name).toBe(
      "Demo Arbitration Account",
    );
    expect(analysis.currency.value).toBe("USDC");
    expect(analysis.total_amount.value).toBe("5000");
    expect(analysis.milestones).toHaveLength(3);
    expect(analysis.milestones.map((milestone) => milestone.amount)).toEqual([
      "1000",
      "2000",
      "2000",
    ]);
    expect(analysis.milestones[0].description).toBe("Design approval");
    expect(analysis.milestones[0].due_date).toBe("2026-11-14T23:59:59.000Z");
    expect(analysis.jurisdiction.value).toBe("England and Wales");
    expect(analysis.milestones.every((milestone) => milestone.status === "extracted")).toBe(true);
  });

  it("keeps unknown fields empty instead of inventing values", () => {
    const analysis = extractAgreementWithRules(
      "This short letter describes a consulting project. No payment terms are included.",
    );
    expect(analysis.total_amount.value).toBeNull();
    expect(analysis.total_amount.status).toBe("missing");
    expect(analysis.parties.every((party) => party.name === null)).toBe(true);
    expect(analysis.issues_for_human_review.length).toBeGreaterThan(3);
  });

  it("extracts alternate party labels and explicit deadlines", () => {
    const analysis = extractAgreementWithRules(`FREELANCE SERVICES CONTRACT

Client: Acme Studios
Contractor: River Fields
Arbitrator: A. Referee

The total fee is $2,500, payable in USDC.

1. Research phase - $1,000 - due 2026-12-01
2. Final delivery - $1,500 - due December 15, 2026`);
    expect(analysis.parties.find((party) => party.role === "payer")?.name).toBe("Acme Studios");
    expect(analysis.parties.find((party) => party.role === "payee")?.name).toBe("River Fields");
    expect(analysis.total_amount.value).toBe("2500");
    expect(analysis.milestones).toHaveLength(2);
    expect(analysis.milestones[0].due_date).toContain("2026-12-01");
  });
});
