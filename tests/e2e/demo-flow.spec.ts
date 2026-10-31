import { expect, test } from "@playwright/test";

test.describe("demo workspace", () => {
  test.describe.configure({ timeout: 300_000 });

  test("creates an agreement from extraction, then funds, submits, releases, and audits it", async ({
    page,
  }) => {
    await page.goto("/agreements/new");
    await expect(page.getByRole("heading", { name: "Start from the agreement" })).toBeVisible();

    await page.getByRole("button", { name: "Load sample agreement" }).click();
    await expect(page.getByTestId("agreement-source-textarea")).toHaveValue(/Northstar Commerce/);
    await page.getByTestId("analyze-button").click();

    await expect(
      page.getByRole("heading", { name: "Review the proposed terms" }),
    ).toBeVisible({ timeout: 60_000 });
    await expect(
      page.getByText("Rules-based demo extraction", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Agreement title")).toHaveValue(
      "Website redesign and development",
    );
    await expect(page.locator("#party-payer")).toHaveValue("Northstar Commerce Ltd");
    await expect(page.locator("#party-payee")).toHaveValue("Studio Nine");

    await page.getByTestId("review-continue").click();
    await expect(
      page.getByRole("heading", { name: "Set parties and milestones" }),
    ).toBeVisible();
    await page.getByTestId("terms-continue").click();

    await expect(
      page.getByRole("heading", { name: "Confirm the approved terms" }),
    ).toBeVisible();
    await expect(page.getByText("Ready to confirm")).toBeVisible();
    await expect(page.locator("code.hash", { hasText: /^0x[0-9a-f]{64}$/ })).toBeVisible();

    await page.getByTestId("review-confirm-checkbox").check();
    await page.getByTestId("create-agreement-button").click();

    await expect(
      page.getByRole("heading", { name: "Website redesign and development" }),
    ).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Awaiting funding", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Fund escrow" }).click();
    await page.getByTestId("confirm-fund").click();
    await expect(page.getByText("Funded", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Active", { exact: true })).toBeVisible();

    await page.getByTestId("demo-role-payee").click();
    const milestone1 = page.locator("#milestone-1");
    await milestone1.getByRole("button", { name: "Submit evidence" }).click();
    await page
      .getByTestId("evidence-description")
      .fill("Approved design prototype, design tokens, and handover notes.");
    await page.getByRole("button", { name: "Use demo artifact" }).click();
    await page.getByTestId("confirm-evidence").click();
    await expect(milestone1.getByText("Awaiting approval", { exact: true })).toBeVisible();

    await page.getByTestId("demo-role-payer").click();
    await milestone1.getByRole("button", { name: "Approve & release" }).click();
    await page.getByTestId("confirm-approve").click();
    await expect(milestone1.getByText("Released", { exact: true })).toBeVisible();
    await expect(milestone1.getByText(/1,000\.00 released to payee/)).toBeVisible();

    await page.getByRole("link", { name: "Audit trail" }).first().click();
    await page.waitForURL("**/audit", { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Audit trail" })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText("No chain reference").first()).toBeVisible();
    await expect(page.getByText(/Demo actions never create hashes or transactions/)).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export JSON" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^pactrail-audit-demo-.*\.json$/);
  });

  test("enforces roles, freezes a disputed milestone, and resolves the split", async ({
    page,
  }) => {
    await page.goto("/agreements/agr_website_redesign");
    const pendingMilestone = page.locator("#milestone-2");
    await expect(page.getByTestId("demo-role-payer")).toHaveAttribute("aria-pressed", "true");
    await expect(
      pendingMilestone.getByRole("button", { name: "Submit evidence" }),
    ).toBeDisabled();
    await expect(
      pendingMilestone.getByRole("button", { name: "Raise dispute" }),
    ).toBeEnabled();

    await page.goto("/agreements/agr_data_migration");
    await expect(page.getByRole("heading", { name: "Data migration and API integration" })).toBeVisible();
    const disputed = page.locator("#milestone-2");
    await expect(disputed.getByText("Disputed", { exact: true })).toBeVisible();
    await expect(disputed.getByRole("button", { name: "Resolve split" })).toBeDisabled();

    await page.getByTestId("demo-role-arbitrator").click();
    const resolve = disputed.getByRole("button", { name: "Resolve split" });
    await expect(resolve).toBeEnabled();
    await resolve.click();

    await expect(page.getByTestId("resolve-payee-amount")).toHaveValue("3200");
    await page.getByTestId("resolve-payee-amount").fill("1200");
    await expect(page.getByTestId("resolve-refund-amount")).toHaveValue("2000");
    await page
      .getByPlaceholder("Explain the basis for the split")
      .fill("Partial acceptance: validation report accepted, rollback evidence rejected.");
    await page.getByTestId("confirm-resolve").click();

    await expect(disputed.getByText("Resolved", { exact: true })).toBeVisible();
    await expect(disputed.getByText("$1,200.00 paid · $2,000.00 refunded")).toBeVisible();
    await expect(disputed.getByText("Dispute resolved", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Audit trail" }).first().click();
    await page.waitForURL("**/audit", { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Audit trail" })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText(/Resolved Cutover and validation/)).toBeVisible();
    await expect(page.getByText(/Refund of 2,000.00 USDC/)).toBeVisible();
  });

  test("verifies evidence bytes against the stored SHA-256 hash", async ({ page }) => {
    await page.goto("/agreements/agr_brand_identity");
    const milestone2 = page.locator("#milestone-2");
    await milestone2.getByRole("button", { name: "Review" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("SHA-256 evidence hash")).toBeVisible();
    const fileInput = dialog.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "identity-system.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(
        "PactRail demo evidence: Identity system boards and logo usage guide",
      ),
    });
    await expect(dialog.getByText("Hash matches the submitted evidence")).toBeVisible();
    await page.getByRole("button", { name: "Close dialog" }).click();
    await expect(page.getByText(/Local SHA-256 check matched/)).toBeVisible();
  });

  test("is usable at a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/overview");
    await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
    await page.getByRole("button", { name: "Open menu" }).click();
    const drawer = page.locator("aside:visible").filter({ hasText: "Workspace" }).first();
    await expect(drawer.getByRole("link", { name: "Agreements" })).toBeVisible();
    await drawer.getByRole("link", { name: "Agreements" }).click();
    await expect(page.getByRole("heading", { name: "Agreements" })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
