# Third-party notices

PactRail source code is licensed under MIT. The following dependencies retain
their own licenses. This list is a practical notice, not a complete legal audit.

| Component | License | Use |
| --- | --- | --- |
| Next.js | MIT | Application framework |
| React / React DOM | MIT | UI runtime |
| wagmi | MIT | Wallet and chain hooks |
| viem | MIT | EVM client, ABI, hashing, unit parsing |
| TanStack Query | MIT | Async state |
| Tailwind CSS | MIT | Styling |
| Tailwind Merge / clsx | MIT | Class composition |
| Lucide | ISC | Icons |
| Zod | MIT | Schema validation |
| Manrope / Newsreader (Fontsource) | SIL Open Font License 1.1 | Bundled variable fonts |
| OpenZeppelin Contracts | MIT | ERC-20, SafeERC20, ReentrancyGuard, Ownable |
| forge-std | MIT | Foundry test helpers |
| Chainlink CCIP contracts (`@chainlink/contracts-ccip`) | BUSL-1.1 | CCIP 2.0 receiver/interfaces used as a dependency |
| Playwright | Apache-2.0 | Browser testing |
| Vitest | MIT | Unit testing |

The Chainlink CCIP package is used as an external dependency and is not
relicensed by this repository. Review its license terms before production or
commercial use. Test-network usage is for the hackathon prototype.

Anvil development accounts and keys printed by Foundry are public test
material and must never be used on a public network or with real assets.
