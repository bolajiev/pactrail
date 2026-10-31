# PactRail Threat Model

## Scope

This threat model covers the PactRail prototype: the Next.js application, browser-local metadata, the AI extraction boundary, the milestone escrow contract, wallet integration, and the optional CCIP audit mirror.

It does not claim production readiness, legal enforceability, regulatory compliance, identity verification, or custody of real funds.

## Assets

| Asset | Location | Impact if compromised |
| --- | --- | --- |
| Escrowed test tokens | `AgreementEscrow` | Wrong release, locked funds, incorrect refund |
| Agreement metadata | Browser localStorage | Privacy loss, tampered display |
| Source agreement text | Browser (opt-in), API request | Confidentiality loss |
| Evidence files | User's device | Confidentiality loss if uploaded; PactRail never uploads them |
| Evidence hashes / terms hashes | On-chain + local | False verification claims, audit confusion |
| Wallet keys | User's wallet | Complete loss of test funds and role control |
| Arbitrator authority | Named address | Biased or unavailable resolution |
| CCIP messages | Optional adapter | Fraudulent audit mirror record |
| AI API key | Server environment | Cost abuse, data exposure if leaked |

## Actors

- Payer (client)
- Payee (contractor)
- Arbitrator
- Observer (read-only wallet or no wallet)
- Application operator (hosts the web app and API)
- AI provider (optional external service)
- Wallet extension / RPC provider
- CCIP router and verifier network (optional)

## Trust boundaries and assumptions

1. Parties trust the deployed escrow address and the token contract. The UI displays both; users are responsible for verifying the address in a real deployment.
2. The payer trusts the arbitrator they selected. PactRail does not vet arbitrators.
3. The payee trusts that the payer will approve valid evidence or that the arbitrator will act. The contract cannot force either.
4. The browser is trusted to render honestly. A compromised browser or wallet extension can mislead the user.
5. The model output is untrusted. Only human-approved terms enter the hash and contract.
6. The local metadata store is not authenticated. An attacker with local device access can alter titles/descriptions, but cannot alter on-chain amounts, roles, or terms hashes.
7. The CCIP adapter trusts the configured router and route. It rejects other senders/chains and replay.

## Threats and mitigations

### Contract and funds

| Threat | Mitigation |
| --- | --- |
| Unauthorized party funds or releases | Role checks against stored payer/payee/arbitrator; tests cover each transition |
| Double funding | `Created` status becomes `Funded`; second call reverts |
| Double release | Milestone must be `Submitted`; marking `Released` before transfer prevents reentry/repeat |
| Release during dispute | Disputed milestone cannot be approved; tests cover |
| Arbitrator changes after funding | Arbitrator is immutable in the agreement; no setter |
| Arbitrator takes all funds arbitrarily | Contract enforces a split summing to the milestone; parties choose the arbitrator; this is a social trust, not solved cryptographically |
| Owner/admin backdoor | No owner, pause, upgrade, or arbitrary withdrawal path |
| Fee-on-transfer token drains other milestones | Contract measures the actual balance delta and reverts if not exact |
| Reverting token leaves inconsistent state | Capability tested; state reverts atomically |
| Reentrancy through token callback | `nonReentrant` on transfer paths and effects before interactions |
| Wrong milestone sum | Creation requires exact total; each amount > 0 |
| Past deadlines | Creation rejects `dueAt <= block.timestamp` |
| Too many milestones | Maximum 32 |
| Evidence URI leaks sensitive data | UI only accepts a short optional reference; files are not uploaded; contract limits URI length |
| Evidence replay across milestones | Evidence hash is stored per milestone; state prevents duplicate submissions on the same milestone |

Residual risks: a malicious arbitrator, a payer who never funds or never reviews, a payee who submits unusable evidence, token contract compromise, chain reorgs, and contract bugs not covered by tests. No independent audit was performed.

### AI and extraction

| Threat | Mitigation |
| --- | --- |
| Model invents parties/amounts/dates | Prompt constraints, schema, null for unknown, source excerpts, human review |
| Prompt injection in agreement text | Text treated as untrusted data in delimiters; system prompt says ignore instructions; only JSON schema accepted |
| Model outputs legal advice/compliance claim | Prompt forbids; UI states AI is assistive only; no enforceability claims |
| Malformed model output | Zod validation; deterministic fallback, clearly labelled |
| API key leakage | Server-only env; never sent to browser; `/api/status` returns only boolean/model name |
| Agreement text logged | No text logging; API returns only structured proposal |
| Rate/cost abuse | 100k char limit, 12 requests/minute per IP, timeout, no retries |
| Source text retained unexpectedly | Off by default; opt-in browser-only storage |

Residual risks: the deterministic fallback can misread unusual agreements. An AI provider may still process the text under its own terms when enabled; the operator must disclose that. The app cannot verify the truth of extracted terms.

### Wallet and network

| Threat | Mitigation |
| --- | --- |
| Wrong-chain transaction | UI compares wallet chain with agreement chain; actions blocked; explicit switch only |
| Wrong-role wallet | Role derived from address; actions disabled; reason shown |
| Malicious RPC returns false state | On-chain reads come from configured RPC; users can use their own RPC; explorer links allow independent verification |
| Wallet connection phishing | Only injected connector; no seed/private-key entry in PactRail |
| Silent network switching | Never automatic; explicit switch button and confirmation |
| Fake transaction success | Only receipts with `status === success` update local state; actual hashes stored |
| Testnet/mainnet confusion | Persistent testnet banners, test-asset labels, Base Sepolia/Anvil only |

Residual risks: compromised wallet extension, malicious RPC, address poisoning, user error. PactRail cannot protect a compromised signing device.

### Local data, privacy, and integrity

| Threat | Mitigation |
| --- | --- |
| Confidential evidence uploaded | Files hashed locally; no upload path |
| Source document retained by default | Opt-in only; privacy copy |
| Local metadata tampering | On-chain hashes and state are the reference; terms hash mismatch warning |
| Local data loss | Explicit limitation; on-chain state remains; no recovery claim |
| XSS in agreement/evidence text | React escaping; external links restricted to http(s)/ipfs/demo paths; no raw HTML rendering |
| CSV formula injection in audit export | CSV is quoted; spreadsheet formula injection is a residual risk for hostile actor names |
| Cache/session leakage | No server-side user store; localStorage is origin-scoped |

Residual risks: a shared browser profile exposes local metadata to other users of that profile. Clearing browser data loses metadata.

### CCIP audit mirror

| Threat | Mitigation |
| --- | --- |
| Forged message from wrong router | `CCIPReceiver` router-only modifier |
| Wrong source chain | Immutable allowed source selector |
| Wrong sender | Immutable allowed sender, ABI-decoded |
| Replay | Message ID processed mapping |
| Malformed payload | Exact 128-byte length check before decode |
| False delivery claim | UI/docs do not claim live CCIP until destination execution is verified; adapter is not in the settlement path |
| Fee griefing/drain | Owner-only send, exact fee approval, balance check |
| Adapter compromise affects escrow | Adapter has no escrow authority; it only stores/mirrors hashes |

Residual risks: a compromised router/verifier network, owner key compromise on the sender, and the fact that an audit mirror is not a legal notarization.

## Out of scope

- Mainnet deployment
- Real stablecoin issuance or redemption
- Fiat on/off ramps
- KYC/AML, sanctions screening, beneficial ownership
- Identity verification or electronic signatures with legal effect
- Court admissibility or enforceability
- Multi-tenant hosting, server-side account recovery, or database security
- DDoS beyond platform-level controls
- Independent smart-contract audit
- Chainlink ACE (private beta at time of research) and sunset Automation products

## Security operations for a future deployment

1. Independent audit of the escrow and adapter.
2. Immutable deployment addresses published out-of-band.
3. RPC diversity and monitoring.
4. Transaction simulation and clear human-readable signing descriptions.
5. CCIP lane verification, curse monitoring, and destination confirmation.
6. Incident response for disputed arbitrators and evidence integrity.
7. Retention policy and privacy notice for optional source text and API processing.
8. Token allowlist / verified stablecoin addresses.
