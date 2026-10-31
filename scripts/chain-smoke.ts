import fs from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEventLogs,
  sha256,
  stringToBytes,
  type Address,
  type Hex,
} from "viem";
import { escrowAbi, erc20Abi } from "../lib/chain/abi";

function loadEnv() {
  if (!fs.existsSync(".env.local")) return {};
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim();
  }
  return env;
}

const env = { ...loadEnv(), ...process.env };
const rpc = env.NEXT_PUBLIC_LOCAL_RPC_URL ?? "http://127.0.0.1:8545";
const escrow = (env.NEXT_PUBLIC_LOCAL_ESCROW ?? process.env.ESCROW) as Address | undefined;
const token = (env.NEXT_PUBLIC_LOCAL_TOKEN ?? process.env.TOKEN) as Address | undefined;

if (!escrow || !token) {
  console.error("Missing escrow/token addresses. Run npm run chain:deploy first.");
  process.exit(1);
}

const payerAddress = (process.env.PAYER_ADDRESS ??
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266") as Address;
const payeeAddress = (process.env.PAYEE_ADDRESS ??
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8") as Address;
const arbitratorAddress = (process.env.ARBITRATOR_ADDRESS ??
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC") as Address;

const publicClient = createPublicClient({ transport: http(rpc) });
const payerClient = createWalletClient({ account: payerAddress, transport: http(rpc) });
const payeeClient = createWalletClient({ account: payeeAddress, transport: http(rpc) });
const arbitratorClient = createWalletClient({ account: arbitratorAddress, transport: http(rpc) });

const ONE = 1_000_000n;
const now = Math.floor(Date.now() / 1000);
const dueAts = [BigInt(now + 30 * 86400), BigInt(now + 60 * 86400), BigInt(now + 90 * 86400)];
const amounts = [1_000n * ONE, 2_000n * ONE, 2_000n * ONE];
const total = 5_000n * ONE;
const termsHash = sha256(stringToBytes("PactRail chain smoke terms v1")) as Hex;

function log(label: string, value: string) {
  console.log(`${label.padEnd(18)} ${value}`);
}

async function main() {
  log("RPC", rpc);
  log("Escrow", escrow!);
  log("Token", token!);

  const balance = await publicClient.readContract({
    abi: erc20Abi,
    address: token!,
    functionName: "balanceOf",
    args: [payerAddress],
  });
  if (balance < total) throw new Error("Payer lacks test token balance. Redeploy.");

  const approveHash = await payerClient.writeContract({
    chain: null,
    abi: erc20Abi,
    address: token!,
    functionName: "approve",
    args: [escrow!, total],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });
  log("Approve tx", approveHash);

  const createHash = await payerClient.writeContract({
    chain: null,
    abi: escrowAbi,
    address: escrow!,
    functionName: "createAgreement",
    args: [payeeAddress, arbitratorAddress, token!, total, termsHash, dueAts, amounts],
  });
  const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash });
  const created = parseEventLogs({
    abi: escrowAbi,
    eventName: "AgreementCreated",
    logs: createReceipt.logs,
  })[0];
  if (!created) throw new Error("AgreementCreated event missing");
  const id = created.args.agreementId;
  log("Create tx", createHash);
  log("Agreement ID", id.toString());

  const fundHash = await payerClient.writeContract({
    chain: null,
    abi: escrowAbi,
    address: escrow!,
    functionName: "fundAgreement",
    args: [id],
  });
  await publicClient.waitForTransactionReceipt({ hash: fundHash });
  log("Fund tx", fundHash);

  const evidenceHash = sha256(stringToBytes("smoke evidence artifact")) as Hex;
  const evidenceTx = await payeeClient.writeContract({
    chain: null,
    abi: escrowAbi,
    address: escrow!,
    functionName: "submitMilestoneEvidence",
    args: [id, 0n, evidenceHash, "demo://smoke-evidence"],
  });
  await publicClient.waitForTransactionReceipt({ hash: evidenceTx });
  log("Evidence tx", evidenceTx);

  const payeeBefore = await publicClient.readContract({
    abi: erc20Abi,
    address: token!,
    functionName: "balanceOf",
    args: [payeeAddress],
  });
  const approveMilestoneTx = await payerClient.writeContract({
    chain: null,
    abi: escrowAbi,
    address: escrow!,
    functionName: "approveMilestone",
    args: [id, 0n],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveMilestoneTx });
  const payeeAfter = await publicClient.readContract({
    abi: erc20Abi,
    address: token!,
    functionName: "balanceOf",
    args: [payeeAddress],
  });
  if (payeeAfter - payeeBefore !== 1_000n * ONE) throw new Error("Release amount mismatch");
  log("Release tx", approveMilestoneTx);
  log("Payee delta", `${(payeeAfter - payeeBefore).toString()} base units`);

  const disputeTx = await payerClient.writeContract({
    chain: null,
    abi: escrowAbi,
    address: escrow!,
    functionName: "raiseDispute",
    args: [id, 1n, sha256(stringToBytes("smoke dispute reason")) as Hex],
  });
  await publicClient.waitForTransactionReceipt({ hash: disputeTx });
  log("Dispute tx", disputeTx);

  const resolveTx = await arbitratorClient.writeContract({
    chain: null,
    abi: escrowAbi,
    address: escrow!,
    functionName: "resolveDispute",
    args: [id, 1n, 1_200n * ONE, 800n * ONE],
  });
  await publicClient.waitForTransactionReceipt({ hash: resolveTx });
  log("Resolve tx", resolveTx);

  const dispute2 = await payeeClient.writeContract({
    chain: null,
    abi: escrowAbi,
    address: escrow!,
    functionName: "raiseDispute",
    args: [id, 2n, sha256(stringToBytes("smoke refund reason")) as Hex],
  });
  await publicClient.waitForTransactionReceipt({ hash: dispute2 });
  const refundTx = await arbitratorClient.writeContract({
    chain: null,
    abi: escrowAbi,
    address: escrow!,
    functionName: "resolveDispute",
    args: [id, 2n, 0n, 2_000n * ONE],
  });
  await publicClient.waitForTransactionReceipt({ hash: refundTx });
  log("Refund tx", refundTx);

  const agreement = await publicClient.readContract({
    abi: escrowAbi,
    address: escrow!,
    functionName: "getAgreement",
    args: [id],
  });
  const milestones = await publicClient.readContract({
    abi: escrowAbi,
    address: escrow!,
    functionName: "getMilestones",
    args: [id],
  });

  log("Final status", agreement.status === 3 ? "Completed" : `Unexpected (${agreement.status})`);
  log(
    "Milestone states",
    milestones
      .map((milestone) => ["Pending", "Submitted", "Released", "Disputed", "Resolved"][milestone.status - 1])
      .join(", "),
  );
  if (agreement.status !== 3) throw new Error("Agreement did not complete");
  console.log("\nChain smoke test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
