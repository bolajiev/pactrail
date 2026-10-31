# PactRail

**Turn commercial agreements into verifiable milestone payments.**

[github.com/bolajiev/pactrail](https://github.com/bolajiev/pactrail)

PactRail connects the terms of a commercial agreement to milestone escrow settlement. It extracts proposed terms from agreement text, requires the parties to review and approve every field, commits a canonical SHA-256 terms hash, and uses a milestone escrow contract to hold test stablecoins until evidence is approved or a dispute is resolved by the named arbitrator.

> **Prototype notice:** PactRail is a hackathon prototype for test networks. It uses test assets only. It does not move real money, does not provide legal advice, and does not establish legal enforceability, identity verification, sanctions compliance, or regulatory approval.

- Workspace demo: no wallet or API key required.
- Live mode: injected browser wallet, Base Sepolia or a local Anvil chain.
- Contract tests: 37 passing (26 escrow, 11 CCIP adapter).
- Browser tests: extraction-to-release demo flow, dispute resolution, evidence verification, mobile layout, and a real local-chain wallet flow.

---

## The problem

Commercial agreements describe who should be paid, for what, when, and on what evidence. Payment rails move money, but they do not understand the agreement that governs it. The result is manual reconciliation, ambiguous acceptance, and weak audit trails.

PactRail makes the agreement itself the source of deterministic settlement rules:

1. **Extract** proposed parties, amounts, deadlines, acceptance criteria, and dispute terms.
2. **Review** every extracted field, with confidence and source excerpts. AI never finalizes terms.
3. **Approve** a canonical terms representation and SHA-256 hash.
4. **Fund** a milestone escrow with a test stablecoin.
5. **Submit evidence** as a hash plus optional short reference. Files stay local.
6. **Release** only after the payer approves, or resolve a dispute through the named arbitrator.
7. **Audit** every decision, hash, and transaction in one timeline.

The core innovation is the agreement-to-settlement workflow, not the use of an LLM by itself.

## Demo story

A small business hires a developer for a 5,000 test-USDC website project:

- **Payer:** Northstar Commerce Ltd
- **Payee:** Studio Nine
- **Arbitrator:** Demo Arbitration Account
- **Milestones:** Design approval (1,000), Frontend implementation (2,000), Final handover (2,000)

The client funds escrow. The developer submits evidence for milestone one. The client reviews the evidence hash and releases 1,000. A dispute freezes milestone two until the arbitrator resolves a split. The complete history remains inspectable.

## What is implemented

### Agreement workflow

- Four-step creation wizard: source, extraction review, parties and schedule, explicit confirmation.
- Source text can be pasted or the sample agreement can be loaded.
- Deterministic rules-based extraction is always available and clearly labelled.
- Optional server-side OpenAI-compatible extraction with schema validation. The API key never reaches the browser.
- Every extracted field carries a status (extracted, inferred, missing, needs review), confidence, and source excerpt.
- Every field is editable. Missing values remain empty rather than being invented.
- Canonical JSON terms, SHA-256 terms hash, and downloadable terms JSON.
- Optional local-only source text retention, off by default.

### Escrow and verification

- Solidity milestone escrow with no owner, no admin withdrawal path, and no upgrade mechanism.
- Role enforcement for payer, payee, and arbitrator.
- SafeERC20 transfers, checks-effects-interactions, reentrancy guard, strict state transitions.
- Fee-on-transfer and reverting token handling.
- Replay-safe CCIP audit mirror adapter (optional, tested locally).
- Browser SHA-256 evidence verification. A hash proves byte matching, not truth.
- Evidence files never leave the browser. Only hashes and optional short references are recorded.
- Dispute freeze, arbitrator-only split resolution, partial awards, full refunds, and completion detection.

### Product interface

- Institutional light theme with responsive navigation and mobile drawer.
- Overview with operational metrics, attention list, recent agreements, and workflow explainer.
- Agreements list with status filters and search.
- Agreement detail with milestone actions, evidence dialog, dispute panel, parties, terms hash, contract links, and activity timeline.
- Audit trail with filters, search, JSON/CSV export, and explicit origin labels: on-chain vs demo vs off-chain.
- Settings for workspace mode, wallet state, configured networks, AI status, privacy, and demo data controls.
- Demo role switching (payer, payee, arbitrator) to exercise permissions without a wallet.
- Wallet menu with account, network, explicit network switching, and explorer links.
- Context-specific disabled actions with reasons.

### Demo mode

The demo workspace contains four resettable sample states:

| Agreement | State |
| --- | --- |
| Website redesign and development | Active, awaiting evidence |
| Brand identity system | Awaiting payer approval |
| Data migration and API integration | Disputed |
| Quarterly content retainer | Completed |

Every simulated action is labelled `Demo event` or `Off-chain`. Demo events never have transaction hashes and never show explorer links. Resetting sample data preserves live records.

## Stack

- **App:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS
- **Web3:** wagmi 2, viem 2, injected wallet connector
- **Contracts:** Solidity 0.8.23, Foundry, OpenZeppelin 5, Chainlink CCIP 2.0 contracts
- **AI:** server-only provider abstraction, Zod validation, deterministic rules fallback
- **Persistence:** versioned localStorage behind a provider/service boundary
- **Testing:** Vitest, Foundry, Playwright

## Quick start — demo workspace

Requirements: Node.js 20+ and pnpm.

```bash
pnpm install
pnpm dev
```

If you cloned the repository rather than receiving this working directory, also run `git submodule update --init --recursive` once to fetch `forge-std` for the contract tests.

Open `http://localhost:3000`. No environment variables are required. The app starts in the demo workspace with four realistic sample agreements and the rules-based extraction fallback.

Then:

1. Open **Website redesign and development**.
2. Use the demo role switch to act as payee and submit evidence.
3. Switch to payer, approve and release the milestone.
4. Open **Data migration and API integration** and resolve the dispute as arbitrator.
5. Open **Audit trail** and export the filtered JSON.

## Quick start — real local chain (Anvil)

This path creates real transactions on a local development chain.

Requirements: Foundry (`forge`, `anvil`, `cast`).

```bash
# terminal 1
pnpm chain:node

# terminal 2
pnpm chain:deploy
```

`chain:deploy` deploys `MockStablecoin` and `AgreementEscrow`, mints test tokens to the first Anvil account, and writes local addresses to `.env.local`. Restart `pnpm dev` after deployment.

In your browser wallet:

1. Add a custom network: RPC `http://127.0.0.1:8545`, chain ID `31337`, currency ETH.
2. Import one of the deterministic development accounts printed by `anvil`. These keys are public test material for a local chain only. Never use them on a real network.
3. Switch the PactRail workspace to **Live** and connect the wallet.
4. Create an agreement, fund it, submit evidence, and approve or dispute it.

The live path is also covered by Playwright using an injected EIP-1193 test provider. The tests send real transactions to a fresh local Anvil chain.

### Base Sepolia

No public testnet deployment is included in this repository. To deploy:

```bash
cd contracts
PRIVATE_KEY=<your testnet key> \
forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://sepolia.base.org \
  --broadcast
```

Then set:

```bash
NEXT_PUBLIC_DEFAULT_CHAIN=base-sepolia
NEXT_PUBLIC_BASE_SEPOLIA_ESCROW=<deployed AgreementEscrow>
NEXT_PUBLIC_BASE_SEPOLIA_TOKEN=<deployed MockStablecoin or approved test token>
NEXT_PUBLIC_BASE_SEPOLIA_TOKEN_SYMBOL=pUSDC
NEXT_PUBLIC_BASE_SEPOLIA_TOKEN_DECIMALS=6
```

The deploy script mints the mock token to the deployer. Test network ETH is required for gas. Never use a mainnet key.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_DEFAULT_CHAIN` | No | `base-sepolia` (default) or `local` |
| `NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL` | No | Defaults to `https://sepolia.base.org` |
| `NEXT_PUBLIC_BASE_SEPOLIA_ESCROW` | Live only | Escrow address |
| `NEXT_PUBLIC_BASE_SEPOLIA_TOKEN` | Live only | ERC-20 test token address |
| `NEXT_PUBLIC_BASE_SEPOLIA_TOKEN_SYMBOL` | No | Display symbol, default `USDC` |
| `NEXT_PUBLIC_BASE_SEPOLIA_TOKEN_DECIMALS` | No | Default `6` |
| `NEXT_PUBLIC_LOCAL_RPC_URL` | No | Defaults to `http://127.0.0.1:8545` |
| `NEXT_PUBLIC_LOCAL_ESCROW` | Local live only | Written by `chain:deploy` |
| `NEXT_PUBLIC_LOCAL_TOKEN` | Local live only | Written by `chain:deploy` |
| `NEXT_PUBLIC_LOCAL_TOKEN_SYMBOL` | No | Default `pUSDC` |
| `NEXT_PUBLIC_LOCAL_TOKEN_DECIMALS` | No | Default `6` |
| `OPENAI_API_KEY` | No | Enables server-side model extraction |
| `PACTRAIL_AI_API_KEY` | No | Alternative server-side key name |
| `PACTRAIL_AI_BASE_URL` | No | OpenAI-compatible base URL |
| `PACTRAIL_AI_MODEL` | No | Default `gpt-4o-mini` |

`OPENAI_API_KEY` and `PACTRAIL_AI_API_KEY` are server-only. They are never exposed to the browser. Without a key, the extraction endpoint returns the clearly labelled rules-based fallback.

See `.env.example` for placeholders.

## Testing

```bash
pnpm typecheck
pnpm lint
pnpm test                  # Vitest: canonicalization, extraction, preflight, permissions
pnpm contracts:test        # Foundry: escrow + CCIP adapter
pnpm build                 # production build
pnpm test:e2e              # Playwright: demo + real local-chain wallet flows
pnpm chain:smoke           # real Anvil lifecycle without a browser
```

Current verified results:

- TypeScript: pass
- ESLint: pass, no warnings
- Vitest: 22 tests pass
- Foundry: 37 tests pass (26 escrow, 11 CCIP adapter)
- Production build: pass
- Playwright: 6 tests pass, including a real local-chain create → fund → evidence → release → dispute → resolve flow
- Chain smoke script: passes on Anvil, final agreement state `Completed`

The Playwright suite starts its own Anvil node on port `8546`, deploys fresh contracts, and injects an EIP-1193 test provider. No real wallet signature is fabricated in the application; the provider uses Anvil's unlocked development accounts to send actual local transactions.

## Chainlink CCIP status

**Implemented and locally tested; not deployed on a live lane.**

`contracts/src/CcipAuditMirror.sol` contains:

- `CcipAuditSender`: builds a CCIP 2.0 `EVM2AnyMessage`, quotes fees in LINK, approves the router, and sends a 128-byte audit anchor.
- `CcipAuditReceiver`: extends the official `CCIPReceiver`, validates the router, source chain selector, source sender, payload shape, and replay protection, then stores the latest audit record per agreement.
- `CcipAuditSender` and `CcipAuditReceiver` tests cover valid delivery, wrong chain, wrong sender, replay, malformed payload, router-only execution, LINK fee handling, and access control.

The adapter mirrors agreement and evidence hashes across chains. It deliberately does **not** move escrow funds, and the production settlement flow does not depend on it.

A live CCIP transfer was not executed because this environment has no funded Base Sepolia or Ethereum Sepolia wallet with testnet ETH/LINK, and the official CCIP faucets require an interactive human verification step. No CCIP transaction, message ID, or destination execution is claimed. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the exact deployment path and current CCIP 2.0 references.

## Contract addresses

No public testnet deployment is included.

A fresh local Anvil deployment from `script/Deploy.s.sol` produces deterministic development addresses (no value, no explorer):

- `MockStablecoin`: `0x5fbdb2315678afecb367f032d93f642f64180aa3`
- `AgreementEscrow`: `0xe7f1725e7734ce288f8367e1bb143e90bb3f0512`

These are only valid for a fresh local chain in the exact deployment order. Always use the addresses written to `.env.local` by your own deployment.

## Security and privacy properties

- Agreement text is not logged by the analysis endpoint.
- Source text is not retained unless the user opts in.
- Evidence files are hashed locally and never uploaded.
- Only hashes and optional short references are written on-chain.
- Demo actions are never represented as transactions.
- The escrow has no owner, upgrade path, or arbitrary withdrawal function.
- The arbitrator is fixed at agreement creation and cannot be changed after funding.
- AI has no authority to approve evidence, resolve disputes, or move funds.
- Network switching is always explicit.

See [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md) for the full model.

## Known limitations

- Off-chain metadata is stored in browser localStorage. Clearing storage loses titles, descriptions, and source copies. On-chain agreement state remains on the chain but is not discoverable in the app without local metadata.
- There is no server-side indexer or multi-device sync.
- The payment token is a test ERC-20. The app does not integrate a production stablecoin or fiat rails.
- AI extraction is assistive and may miss or misread terms. The deterministic fallback is intentionally conservative.
- The CCIP adapter is tested with a mock router only and is not deployed on a live lane.
- There is no KYC/AML, sanctions screening, identity verification, or legal enforceability claim.
- Contract code has not been independently audited.
- The app currently supports Base Sepolia and a local Anvil chain.

## Hackathon submission status

Event: **BLI Legal Tech Hackathon 2** on DoraHacks, submission deadline **2026-11-01 01:01 UTC**.

The DoraHacks Tracks page was behind an interactive human-verification challenge during this build, and the organiser update states the event has two tracks without exposing their exact labels in the public material reviewed. The rendered page outline showed broad categories including **LegalTech & RegTech** and **AI x Blockchain**, and PactRail fits the legaltech/payment-rails theme, but no exact official track name is claimed here. Confirm the exact track label in the DoraHacks submission portal before submitting.

Submission checklist:

- [x] Public-ready repository contents
- [x] Working application
- [x] Contract and browser tests
- [x] Architecture documentation
- [x] Threat model
- [x] Demo script
- [x] Demo recording (`docs/pactrail-demo.mp4`, 3:12, captioned)
- [x] Public GitHub repository: https://github.com/bolajiev/pactrail
- [ ] DoraHacks build submission and exact track selection

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Threat model](docs/THREAT_MODEL.md)
- [Demo script](docs/DEMO_SCRIPT.md)
- [Demo video](docs/pactrail-demo.mp4)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## Repository layout

```text
app/                  Next.js routes and API endpoints
components/           UI, layout, wizard, agreement, evidence, wallet
lib/                  domain logic, AI boundary, chain config, store, demo seed
contracts/            Foundry escrow, CCIP adapter, mocks, tests, deploy scripts
tests/unit/           Vitest domain tests
tests/e2e/            Playwright demo and live-chain tests
scripts/              local deploy, chain smoke, E2E server
docs/                 architecture, threat model, demo script, submission notes
```

## License

MIT for PactRail source code. Dependencies retain their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The Chainlink CCIP contracts package is licensed under BUSL-1.1 and is used as a dependency, not relicensed.
