# DoraHacks submission notes

## Project

**PactRail — turn commercial agreements into verifiable milestone payments.**

Legal-tech infrastructure that extracts proposed agreement terms, requires
human approval, hashes the approved terms, and settles milestones through an
escrow contract with evidence hashes, explicit payer release, disputes, and
arbitrator resolution.

## Suggested short description

PactRail connects commercial agreements to milestone escrow. It extracts
parties, amounts, deadlines, and acceptance criteria; requires the parties to
review and approve every field; commits a SHA-256 terms hash; and releases test
stablecoins only on payer approval or named-arbitrator resolution. Evidence is
hashed locally, files are never uploaded, and every decision is recorded in an
audit trail that clearly separates demo events, off-chain records, and real
testnet transactions.

## Categories / tags

- LegalTech
- RegTech
- Stablecoins
- Payments
- Escrow
- AI assistive review
- Chainlink CCIP
- Ethereum / Base Sepolia

## Track selection

The official DoraHacks Tracks page was protected by a human-verification
challenge during this build. The public organiser update states there are two
tracks; the exact current labels could not be verified through the public page
from this environment. Do not submit a guessed track name.

Before submitting, open:

- https://dorahacks.io/hackathon/legal-hack-2026/tracks

Select the track whose description covers legal technology / practical
payments infrastructure / AI-assisted legal workflows. PactRail fits the
legal-tech and payment-rails theme. Record the exact label in the submission
and in this document.

## Repository checklist

- [x] App and contracts
- [x] README with setup and limitations
- [x] Architecture document
- [x] Threat model
- [x] Demo script
- [x] Automated tests
- [x] No secrets committed
- [x] Public GitHub URL: https://github.com/bolajiev/pactrail
- [x] Demo video file: `docs/pactrail-demo.mp4` (3:12, captioned)
- [ ] DoraHacks build submitted with exact track

## Judge quick path

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`. Use the demo workspace. No wallet, API key, or
funded account is needed.

Fast path:

1. Open **Website redesign and development**.
2. Switch demo role to **Payee**, submit evidence, use the demo artifact.
3. Switch to **Payer**, approve and release.
4. Open **Data migration and API integration**, switch to **Arbitrator**, resolve the split.
5. Open **Audit trail**, filter and export JSON.
6. Reload the page to confirm local persistence, then use **Settings → Restore sample agreements**.

## Claims we do not make

- No real money or mainnet settlement.
- No legal advice or enforceability guarantee.
- No KYC/AML or identity verification.
- No live public CCIP transfer in this build.
- No public Base Sepolia deployment.
- No independent security audit.
