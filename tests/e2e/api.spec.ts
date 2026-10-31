import { expect, test } from "@playwright/test";
import { SAMPLE_AGREEMENT_TEXT } from "../../lib/demo/sample-agreement";

test("analysis API validates input and returns a labelled rules fallback", async ({
  request,
}) => {
  const short = await request.post("/api/analyze-agreement", {
    data: { text: "too short" },
  });
  expect(short.status()).toBe(400);

  const malformed = await request.post("/api/analyze-agreement", {
    data: { nope: true },
  });
  expect(malformed.status()).toBe(400);

  const response = await request.post("/api/analyze-agreement", {
    data: { text: SAMPLE_AGREEMENT_TEXT },
  });
  expect(response.status()).toBe(200);
  const payload = (await response.json()) as {
    mode: string;
    notice: string;
    analysis: {
      title: { value: string };
      total_amount: { value: string };
      milestones: unknown[];
      parties: Array<{ role: string; name: string }>;
    };
  };
  expect(payload.mode).toBe("rules-demo");
  expect(payload.notice).toContain("not a language model");
  expect(payload.analysis.title.value).toBe("Website redesign and development");
  expect(payload.analysis.total_amount.value).toBe("5000");
  expect(payload.analysis.milestones).toHaveLength(3);
  expect(payload.analysis.parties.find((party) => party.role === "payee")?.name).toBe(
    "Studio Nine",
  );
});
