# PactRail — 3–5 minute demo walkthrough

**Audience:** judges, legal-tech reviewers, sponsor engineers
**Goal:** show agreement extraction, human approval, real escrow rules, evidence verification, dispute resolution, and the audit trail in one coherent journey.
**Default path:** demo workspace, no wallet or API key.
**Backup path:** local Anvil live mode, described at the end.

> Say clearly at the start: "This is a test-network prototype. Demo actions are simulated locally. Live mode uses test assets and never real money."

---

## 0:00–0:20 — Opening

Open `http://localhost:3000/overview` in a desktop browser.

**On screen:** overview, four metrics, sample agreements, demo banner.

**Narration:**
> PactRail turns a commercial agreement into verifiable milestone payments. The key idea is not an AI chatbot. It is a reviewed agreement-to-settlement workflow: AI proposes terms, people approve them, and a small escrow contract enforces only the approved rules.

Point out the persistent **Demo workspace** banner: actions are local and never create blockchain transactions.

---

## 0:20–0:50 — The sample agreement

Click **Website redesign and development** in **Recent agreements**.

**On screen:** 5,000 test-USDC agreement, three milestones, parties, terms hash, escrow summary, timeline.

**Narration:**
> This is a 5,000 test-USDC website project from Northstar Commerce to Studio Nine. One milestone is released, one is awaiting evidence, and one is still pending. The agreement has a canonical terms hash, and every action is recorded in a timeline that distinguishes demo events from on-chain transactions.

Click the **Payer / Payee / Arbitrator** demo role switch to show that permissions are role-aware. Keep **Payer** selected for the next step.

Do not approve anything yet.

---

## 0:50–1:30 — Evidence and release

Open **Audit trail** once to show the cross-agreement record, then go back to the sample agreement.

1. Under **Frontend implementation**, click **Submit evidence**.
2. Notice it is disabled for the payer with the reason “Only the payee can submit evidence.”
3. Switch the demo role to **Payee**.
4. Click **Submit evidence**.
5. Enter: “Staging build and browser test report for the responsive frontend.”
6. Click **Use demo artifact**. The app computes a real SHA-256 over the demo artifact.
7. Click **Record demo evidence**.
8. Show the milestone move to **Awaiting approval**.
9. Switch back to **Payer**.
10. Click **Approve & release**, then confirm.

**Narration:**
> Evidence is not uploaded. PactRail hashes the file or artifact in the browser and records only the digest and a short reference. The hash lets a reviewer check that the bytes match. It does not prove the document is true. Release is a separate, explicit payer action and transfers exactly the milestone amount.

After release, point out:
- the milestone status is **Released**;
- the exact amount shown in the release footer;
- the new **Demo event** entries in the timeline.

---

## 1:30–2:20 — Dispute and arbitration

Open **Data migration and API integration** from the sidebar.

**On screen:** milestone two is disputed, 2,400 released, 3,200 disputed, 1,600 pending.

**Narration:**
> A dispute is not a support ticket. The disputed milestone is frozen in the escrow. Ordinary release is blocked. Only the named arbitrator can choose a split, and the split must add up to the milestone amount.

1. Show that **Resolve split** is disabled for the payer.
2. Switch the demo role to **Arbitrator**.
3. Click **Resolve split**.
4. Set payee award to `1,200`; the payer refund computes to `2,000`.
5. Enter: “Validation report accepted; rollback evidence rejected.”
6. Click **Record demo resolution**.
7. Show **Resolved**, the split, the reason hash, and the new audit events.

**Narration:**
> The dispute reason is kept with the local record; only its hash is written to the contract in live mode. The arbitrator's split is recorded and the remaining milestones continue normally.

---

## 2:20–3:10 — Create from agreement text

Click **Create agreement**.

1. Click **Load sample agreement**.
2. Point out the sample text and click **Analyse agreement**.
3. On the extraction step, show:
   - **Rules-based demo extraction** badge (or “AI-proposed extraction” if a key is configured);
   - confidence and source excerpts;
   - every field editable;
   - human-review issues.
4. Edit the title or a milestone amount and point out that the total updates from the schedule.
5. Click **Continue to parties**.
6. Show parties, token, addresses (demo identities), and the milestone schedule.
7. Click **Review and confirm**.
8. Show the **Workflow preflight** checks, the canonical terms hash, and the canonical JSON toggle.
9. Point out the explicit approval checkbox.
10. Read the demo creation note: “No wallet, token transfer, or blockchain transaction occurs.”
11. Click **Create demo agreement**.
12. Show the new agreement in **Awaiting funding**.
13. Click **Fund escrow**, confirm, and show it becomes **Active**.

**Narration:**
> This is the responsible-automation boundary. The extractor proposes. The parties edit and approve. Only then is the canonical terms hash generated. The escrow is a separate funding action, and the contract will not release anything without a later payer approval or arbitration decision.

Stop here if the demo is running long. The audit trail is the closing proof.

---

## 3:10–3:50 — Audit trail and evidence verification

Open **Audit trail**.

1. Point out the origins: **On-chain**, **Demo event**, **Off-chain**.
2. Filter by **Disputes**, then **Evidence**.
3. Search for “Northstar”.
4. Click **Export JSON** and show the downloaded file.
5. Open **Brand identity system** from the filtered list (or navigate back to agreements).
6. Under **Identity system delivery**, click **Review**.
7. Show the full SHA-256 hash and the **Verify a local copy** panel.
8. Click the **Download demo artifact** link, download the text file, then choose the same file in the verifier.
9. Show **Hash matches the submitted evidence**.
10. Close the dialog and show the “Local SHA-256 check matched” timeline entry.

**Narration:**
> The audit trail is not a marketing log. It separates demo records, off-chain approvals, and real transactions. The verification tool is deliberately narrow: it confirms byte-level matching. It does not claim the document is truthful or legally sufficient.

---

## 3:50–4:20 — Live mode proof (optional)

If time and a local chain are available:

1. Switch workspace to **Live**.
2. Connect the injected wallet configured for Anvil.
3. Open an existing live agreement or create one.
4. Show the **Funded** state, the real transaction hash in the timeline, the contract address, and the block number.
5. Open BaseScan Sepolia or the local RPC file only if the deployment actually exists. Never show a fabricated explorer link.

**Narration:**
> Live mode uses the same UI and the same contract rules, but actions are signed by the connected wallet and the state is read from the escrow. This build is tested end to end on a local Anvil chain. No public testnet deployment is included because this environment did not have funded testnet accounts.

---

## 4:20–4:40 — Close

Return to **Overview**.

**Narration:**
> PactRail is a complete vertical slice: extract, review, approve, fund, submit evidence, release, dispute, resolve, and audit. The smart contract has no admin withdrawal path. AI cannot move money. Demo actions are clearly separated from real testnet transactions. The repository contains the architecture, threat model, tests, and reproduction steps.

---

## Fallback plan if something is slow

- **AI endpoint slow/unavailable:** use the rules-based fallback. It is a supported, labelled path, not an error.
- **Wallet unavailable:** complete the entire demo in the demo workspace. Every judge-visible product behavior works there.
- **Local chain not running:** skip the live section and show the recorded live test or the chain smoke output in the repository.
- **Page still compiling in dev:** use a production build (`pnpm build && pnpm start`) for the recorded demo.
- **Testnet explorer unavailable:** show the local transaction hash and block number; never invent an explorer link.

## Screen recording

A captioned screen recording of the demo path is provided at `docs/pactrail-demo.mp4` (3:11). The recording shows the actual application and local demo events; it does not depict a public testnet deployment.
