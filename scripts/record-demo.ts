import { chromium, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.DEMO_URL ?? "http://127.0.0.1:3020";
const VIDEO_DIR = "/tmp/pactrail-video";
const OUTPUT = path.resolve("docs/pactrail-demo.mp4");

async function caption(page: Page, step: string, title: string, body: string, ms = 4500) {
  await page.evaluate(
    ({ step, title, body }) => {
      let overlay = document.getElementById("pactrail-recording-caption");
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "pactrail-recording-caption";
        document.body.appendChild(overlay);
      }
      overlay.setAttribute(
        "style",
        [
          "position:fixed",
          "left:50%",
          "bottom:22px",
          "transform:translateX(-50%)",
          "z-index:2147483647",
          "width:min(860px,calc(100vw - 40px))",
          "background:rgba(13,28,23,0.94)",
          "border:1px solid rgba(255,255,255,0.14)",
          "border-radius:14px",
          "padding:14px 18px",
          "box-shadow:0 20px 50px rgba(0,0,0,0.32)",
          "color:#f7f4ec",
          "font-family:Manrope Variable,ui-sans-serif,system-ui,sans-serif",
          "pointer-events:none",
          "backdrop-filter:blur(6px)",
        ].join(";"),
      );
      overlay.innerHTML = `
        <div style="display:flex;gap:10px;align-items:baseline;margin-bottom:4px">
          <span style="font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#c8b891">${step}</span>
          <span style="font-family:Newsreader Variable,Georgia,serif;font-size:19px;line-height:1.2">${title}</span>
        </div>
        <div style="font-size:12px;line-height:1.55;color:rgba(247,244,236,.72);max-width:780px">${body}</div>
      `;
    },
    { step, title, body },
  );
  await page.waitForTimeout(ms);
}

async function scrollTop(page: Page) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await page.waitForTimeout(500);
}

async function main() {
  fs.rmSync(VIDEO_DIR, { recursive: true, force: true });
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);

  await page.goto(`${BASE}/overview`, { waitUntil: "networkidle" });
  await caption(
    page,
    "01 / Overview",
    "PactRail turns agreements into milestone settlement",
    "Agreement text becomes reviewed terms, a terms hash, an escrow, evidence records, and a verifiable audit trail. This walkthrough uses the demo workspace; no wallet or real funds are involved.",
    9000,
  );

  await page.getByRole("link", { name: "Website redesign and development" }).first().click();
  await page.waitForLoadState("networkidle");
  await scrollTop(page);
  await caption(
    page,
    "02 / Agreement detail",
    "A human-approved terms hash anchors the record",
    "The sample project is 5,000 test USDC across three milestones. The payer, payee, arbitrator, amounts, and deadlines are fixed. Demo events are labelled separately from any real testnet transaction.",
    9000,
  );

  await page.getByText("Milestones", { exact: true }).scrollIntoViewIfNeeded();
  await caption(
    page,
    "03 / Milestone evidence",
    "Evidence is a hash, not an upload",
    "The payer currently cannot submit evidence; the button is disabled with a reason. Switch the demo role to Payee and submit a local artifact. The file never leaves the browser.",
    8000,
  );

  await page.getByTestId("demo-role-payee").click();
  await page.getByRole("button", { name: "Submit evidence" }).first().click();
  await page
    .getByTestId("evidence-description")
    .fill("Staging build and browser test report for the responsive frontend.");
  await page.getByRole("button", { name: "Use demo artifact" }).click();
  await caption(
    page,
    "04 / Evidence hash",
    "Only the digest and a short reference are recorded",
    "PactRail computes SHA-256 in the browser. A hash helps verify that bytes match the submitted artifact; it does not prove the document is true or legally sufficient.",
    8000,
  );
  await page.getByTestId("confirm-evidence").click();
  await caption(
    page,
    "05 / Awaiting approval",
    "Submission does not move money",
    "The milestone now waits for the payer. The contract has no automatic release path and no AI role in approval.",
    7000,
  );

  await page.getByTestId("demo-role-payer").click();
  await page.getByRole("button", { name: "Approve & release" }).click();
  await caption(
    page,
    "06 / Payer approval",
    "Release is an explicit, role-bound action",
    "Approval transfers exactly 1,000 test USDC to the payee and makes the milestone terminal. It cannot be released or disputed again.",
    7500,
  );
  await page.getByTestId("confirm-approve").click();
  await page.waitForTimeout(1200);
  await caption(
    page,
    "07 / Released",
    "The release and evidence hash enter the timeline",
    "The audit trail records the actor, time, action, and hash reference. Demo events never display a fabricated transaction hash.",
    7500,
  );

  await page.goto(`${BASE}/agreements/agr_data_migration`, { waitUntil: "networkidle" });
  await scrollTop(page);
  await page.getByRole("heading", { name: "Cutover and validation" }).scrollIntoViewIfNeeded();
  await caption(
    page,
    "08 / Dispute",
    "A disputed milestone is frozen",
    "Either party can dispute an unreleased milestone. Ordinary approval is blocked. Only the named arbitrator can resolve the split.",
    8500,
  );

  await page.getByTestId("demo-role-arbitrator").click();
  await page.getByRole("button", { name: "Resolve split" }).click();
  await page.getByTestId("resolve-payee-amount").fill("1200");
  await page
    .getByPlaceholder("Explain the basis for the split")
    .fill("Validation report accepted; rollback evidence rejected.");
  await caption(
    page,
    "09 / Arbitration",
    "The arbitrator's split must equal the milestone amount",
    "Here 1,200 goes to the payee and 2,000 is refunded to the payer. The contract enforces the arithmetic; the reason stays with the local record and its hash is referenced.",
    9000,
  );
  await page.getByTestId("confirm-resolve").click();
  await page.waitForTimeout(1200);
  await caption(
    page,
    "10 / Resolved",
    "Settlement continues milestone by milestone",
    "The remaining milestone is unaffected. The resolution, refund, and rationale are recorded in the activity timeline.",
    7000,
  );

  await page.getByRole("link", { name: "Audit trail" }).first().click();
  await page.waitForURL("**/audit");
  await page.waitForLoadState("networkidle");
  await scrollTop(page);
  await caption(
    page,
    "11 / Audit trail",
    "Every origin is labelled honestly",
    "On-chain, demo, and off-chain records are distinct. Search, status filters, and JSON/CSV export make the record inspectable without a verbal explanation.",
    8500,
  );
  await page.getByRole("button", { name: "CSV" }).click();
  await page.waitForTimeout(1200);

  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await scrollTop(page);
  await caption(
    page,
    "12 / Workspace boundaries",
    "Demo and live records are deliberately separate",
    "Demo mode needs no wallet or API key and never creates transactions. Live mode uses build-time contract addresses, an injected wallet, and explicit network switching. The AI key, when configured, stays server-side.",
    10000,
  );

  await page.goto(`${BASE}/agreements/new`, { waitUntil: "networkidle" });
  await scrollTop(page);
  await caption(
    page,
    "13 / Create from agreement text",
    "Extraction is a proposal, never a final decision",
    "Load the sample agreement. The rules-based demo extractor is used when no AI key is configured, and the result is labelled accordingly.",
    7500,
  );
  await page.getByRole("button", { name: "Load sample agreement" }).click();
  await page.getByTestId("analyze-button").click();
  await page.getByRole("heading", { name: "Review the proposed terms" }).waitFor();
  await page.waitForTimeout(800);
  await caption(
    page,
    "14 / Human review",
    "Every field is editable and shows its provenance",
    "Title, scope, parties, amounts, deadlines, and acceptance criteria were proposed with confidence values and source excerpts. Missing values stay empty rather than being invented.",
    9000,
  );
  await page.locator("#wizard-title").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await page.getByTestId("review-continue").click();
  await page.getByTestId("terms-continue").click();
  await page.getByRole("heading", { name: "Confirm the approved terms" }).waitFor();
  await page.waitForTimeout(800);
  await caption(
    page,
    "15 / Deterministic preflight",
    "The parties confirm the exact canonical terms",
    "Preflight checks validate the schedule, roles, deadlines, token, and context. The SHA-256 terms hash is computed over the canonical JSON shown below.",
    8500,
  );
  await page.getByTestId("review-confirm-checkbox").check();
  await page.getByTestId("create-agreement-button").click();
  await page.waitForURL(/\/agreements\/agr_/);
  await page.waitForLoadState("networkidle");
  await scrollTop(page);
  await caption(
    page,
    "16 / Awaiting funding",
    "A separate, deliberate funding step",
    "Creation records the reviewed terms. Funding is the next explicit action. In live mode this is where the payer signs the testnet deposit.",
    7500,
  );
  await page.getByTestId("demo-role-payer").click();
  await page.getByRole("button", { name: "Fund escrow" }).click();
  await page.getByTestId("confirm-fund").click();
  await page.waitForTimeout(1200);
  await caption(
    page,
    "17 / Active",
    "The escrow now holds the milestone funds",
    "Release still requires milestone evidence and payer approval. The prototype never fabricates a transaction or a successful transfer.",
    7500,
  );

  await page.goto(`${BASE}/overview`, { waitUntil: "networkidle" });
  await scrollTop(page);
  await caption(
    page,
    "18 / Complete workflow",
    "Extract, review, approve, fund, evidence, settle, dispute, resolve, audit",
    "PactRail is a working vertical slice with 37 contract tests, 22 domain tests, and 6 browser tests. Demo mode works without a wallet; live mode is tested on a real local chain. Test assets only; not legal advice.",
    11000,
  );

  const video = page.video();
  await page.close();
  await context.close();
  await browser.close();
  if (!video) throw new Error("No video was recorded.");
  const webmPath = await video.path();
  console.log(`Recorded: ${webmPath}`);
  console.log(`Convert to MP4 with ffmpeg -i ${webmPath} -c:v libx264 -pix_fmt yuv420p -movflags +faststart ${OUTPUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
