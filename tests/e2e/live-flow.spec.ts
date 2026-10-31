import { expect, test, type Page } from "@playwright/test";

const RPC_URL = "http://127.0.0.1:8546";
const ACCOUNTS = [
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
] as const;

async function installWallet(page: Page) {
  await page.addInitScript(
    ({ rpcUrl, accounts }) => {
      let selected = 0;
      const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
      const emit = (event: string, args: unknown[]) => {
        for (const listener of listeners.get(event) ?? []) listener(...args);
      };
      const rpc = async (method: string, params: unknown[]) => {
        const payload: Record<string, unknown> = {
          jsonrpc: "2.0",
          id: Date.now(),
          method,
          params,
        };
        if (method === "eth_sendTransaction") {
          const transaction = (params[0] ?? {}) as Record<string, unknown>;
          transaction.from = accounts[selected];
          payload.params = [transaction, ...params.slice(1)];
        }
        const response = await fetch(rpcUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = (await response.json()) as { result?: unknown; error?: { message: string } };
        if (json.error) throw new Error(json.error.message);
        return json.result;
      };
      const provider = {
        isMetaMask: true,
        get selectedAddress() {
          return accounts[selected];
        },
        get chainId() {
          return "0x7a69";
        },
        async request({ method, params }: { method: string; params?: unknown[] }) {
          if (method === "eth_requestAccounts" || method === "eth_accounts") {
            return [accounts[selected]];
          }
          if (method === "eth_chainId") return "0x7a69";
          if (method === "net_version") return "31337";
          if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") {
            return null;
          }
          if (method === "wallet_requestPermissions") {
            return [{ parentCapability: "eth_accounts" }];
          }
          if (method === "wallet_getPermissions") {
            return [{ parentCapability: "eth_accounts" }];
          }
          return rpc(method, params ?? []);
        },
        on(event: string, listener: (...args: unknown[]) => void) {
          listeners.set(event, [...(listeners.get(event) ?? []), listener]);
        },
        removeListener(event: string, listener: (...args: unknown[]) => void) {
          listeners.set(event, (listeners.get(event) ?? []).filter((item) => item !== listener));
        },
      };
      Object.defineProperty(window, "ethereum", { value: provider, configurable: true });
      (window as unknown as { __setPactRailAccount: (index: number) => void }).__setPactRailAccount = (
        index: number,
      ) => {
        selected = index;
        emit("accountsChanged", [[accounts[index]]]);
      };
    },
    { rpcUrl: RPC_URL, accounts: [...ACCOUNTS] },
  );
}

async function setAccount(page: Page, index: number) {
  await page.evaluate(
    (nextIndex) =>
      (
        window as unknown as { __setPactRailAccount: (index: number) => void }
      ).__setPactRailAccount(nextIndex),
    index,
  );
}

test("live wallet: create, fund, evidence, release, dispute, and resolve on a real local chain", async ({
  page,
}) => {
  test.setTimeout(420_000);
  await installWallet(page);
  await page.goto("/overview");

  await page.locator("aside").first().getByRole("button", { name: "live", exact: true }).click();
  await expect(page.getByText(/Live workspace — real testnet transactions/)).toBeVisible();

  await page.getByRole("button", { name: "Connect wallet" }).first().click();
  await expect(page.getByRole("button", { name: /0xf39F/ }).first()).toBeVisible({
    timeout: 30_000,
  });

  await page.goto("/agreements/new");
  await page.getByRole("button", { name: "Load sample agreement" }).click();
  await page.getByTestId("analyze-button").click();
  await expect(
    page.getByRole("heading", { name: "Review the proposed terms" }),
  ).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("review-continue").click();
  await expect(page.getByRole("heading", { name: "Set parties and milestones" })).toBeVisible();
  await expect(page.getByTestId("party-payer-address")).toHaveValue(ACCOUNTS[0]);
  await page.getByTestId("party-payee-address").fill(ACCOUNTS[1]);
  await page.getByTestId("party-arbitrator-address").fill(ACCOUNTS[2]);

  await page.getByTestId("terms-continue").click();
  await expect(page.getByText("Ready to confirm")).toBeVisible();
  await page.getByTestId("review-confirm-checkbox").check();
  await page.getByTestId("create-agreement-button").click();

  await expect(
    page.getByRole("heading", { name: "Website redesign and development" }),
  ).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("Awaiting funding", { exact: true })).toBeVisible();
  await expect(page.getByText(/On-chain/).first()).toBeVisible();

  await page.getByRole("button", { name: "Fund escrow" }).click();
  await page.getByTestId("confirm-fund").click();
  await expect(page.getByText("Funded", { exact: true }).first()).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByText("Active", { exact: true })).toBeVisible();

  await setAccount(page, 1);
  await expect(page.getByText(/Acting as.*Studio Nine/)).toBeVisible({ timeout: 30_000 });
  const milestone1 = page.locator("#milestone-1");
  const submit = milestone1.getByRole("button", { name: "Submit evidence" });
  await expect(submit).toBeEnabled({ timeout: 30_000 });
  await submit.click();
  await page.getByTestId("evidence-description").fill("Live test evidence for design approval.");
  await page.getByTestId("evidence-hash").fill("a".repeat(64));
  await page.getByTestId("confirm-evidence").click();
  await expect(milestone1.getByText("Awaiting approval", { exact: true })).toBeVisible({
    timeout: 90_000,
  });

  await setAccount(page, 0);
  await expect(page.getByText(/Acting as.*Northstar Commerce Ltd/)).toBeVisible({
    timeout: 30_000,
  });
  await milestone1.getByRole("button", { name: "Approve & release" }).click();
  await page.getByTestId("confirm-approve").click();
  await expect(milestone1.getByText("Released", { exact: true })).toBeVisible({
    timeout: 90_000,
  });

  const milestone2 = page.locator("#milestone-2");
  await milestone2.getByRole("button", { name: "Raise dispute" }).click();
  await page
    .getByTestId("dispute-reason")
    .fill("Live test: the acceptance evidence is incomplete.");
  await page.getByTestId("confirm-dispute").click();
  await expect(milestone2.getByText("Disputed", { exact: true })).toBeVisible({
    timeout: 90_000,
  });

  await setAccount(page, 2);
  await expect(page.getByText(/Acting as.*Demo Arbitration Account/)).toBeVisible({
    timeout: 30_000,
  });
  await milestone2.getByRole("button", { name: "Resolve split" }).click();
  await page.getByTestId("resolve-payee-amount").fill("1000");
  await expect(page.getByTestId("resolve-refund-amount")).toHaveValue("1000");
  await page
    .getByPlaceholder("Explain the basis for the split")
    .fill("Live test partial resolution after reviewing both positions.");
  await page.getByTestId("confirm-resolve").click();
  await expect(milestone2.getByText("Resolved", { exact: true })).toBeVisible({
    timeout: 90_000,
  });

  await page.getByRole("link", { name: "Audit trail" }).first().click();
  await page.waitForURL("**/audit", { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Audit trail" })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText("On-chain").first()).toBeVisible();
  await expect(page.getByText(/Resolved Frontend implementation/)).toBeVisible();
});
