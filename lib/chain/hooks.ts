"use client";

import { useCallback, useMemo } from "react";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import {
  parseEventLogs,
  sha256,
  stringToBytes,
  type Hash,
  type TransactionReceipt,
} from "viem";
import { erc20Abi, escrowAbi } from "@/lib/chain/abi";
import { networkFor } from "@/lib/chain/config";
import type { Agreement, EvidenceRecord, Milestone } from "@/lib/types";
import type { AgreementDraft } from "@/lib/agreement/canonical";

export interface OnchainMilestoneView {
  index: number;
  amount: bigint;
  dueAt: bigint;
  status: number;
  evidenceHash: `0x${string}`;
  evidenceUri: string;
  submittedAt: bigint;
  resolvedAt: bigint;
  releasedAmount: bigint;
  refundedAmount: bigint;
  disputeReasonHash: `0x${string}`;
}

export interface OnchainAgreementView {
  payer: `0x${string}`;
  payee: `0x${string}`;
  arbitrator: `0x${string}`;
  token: `0x${string}`;
  totalAmount: bigint;
  termsHash: `0x${string}`;
  createdAt: bigint;
  fundedAt: bigint;
  status: number;
  milestones: OnchainMilestoneView[];
}

export function useOnchainAgreement(agreement?: Agreement) {
  const chainRef = agreement?.mode === "live" ? agreement.chain : null;
  const enabled = Boolean(chainRef);
  const account = useAccount();

  const agreementRead = useReadContract({
    abi: escrowAbi,
    address: chainRef?.contractAddress,
    functionName: "getAgreement",
    args: chainRef ? [BigInt(chainRef.onchainAgreementId)] : undefined,
    chainId: chainRef?.chainId,
    query: {
      enabled,
      refetchInterval: 6_000,
      staleTime: 2_000,
    },
  });

  const milestonesRead = useReadContract({
    abi: escrowAbi,
    address: chainRef?.contractAddress,
    functionName: "getMilestones",
    args: chainRef ? [BigInt(chainRef.onchainAgreementId)] : undefined,
    chainId: chainRef?.chainId,
    query: {
      enabled,
      refetchInterval: 6_000,
      staleTime: 2_000,
    },
  });

  const data = useMemo<OnchainAgreementView | null>(() => {
    if (!agreementRead.data || !milestonesRead.data) return null;
    const base = agreementRead.data as unknown as {
      payer: `0x${string}`;
      payee: `0x${string}`;
      arbitrator: `0x${string}`;
      token: `0x${string}`;
      totalAmount: bigint;
      termsHash: `0x${string}`;
      createdAt: bigint;
      fundedAt: bigint;
      status: number;
    };
    const milestones = milestonesRead.data as unknown as Array<{
      amount: bigint;
      dueAt: bigint;
      status: number;
      evidenceHash: `0x${string}`;
      evidenceUri: string;
      submittedAt: bigint;
      resolvedAt: bigint;
      releasedAmount: bigint;
      refundedAmount: bigint;
      disputeReasonHash: `0x${string}`;
    }>;
    return {
      ...base,
      milestones: milestones.map((milestone, index) => ({ ...milestone, index })),
    };
  }, [agreementRead.data, milestonesRead.data]);

  const refetch = useCallback(async () => {
    await Promise.all([agreementRead.refetch(), milestonesRead.refetch()]);
  }, [agreementRead, milestonesRead]);

  return {
    data,
    isLoading: enabled && (agreementRead.isLoading || milestonesRead.isLoading),
    error: agreementRead.error ?? milestonesRead.error ?? null,
    refetch,
    canRead: enabled && Boolean(networkFor(chainRef?.chainId)),
    account,
  };
}

function mapMilestoneStatus(status: number, releasedAmount: bigint, amount: bigint): Milestone["status"] {
  if (status === 2) return "submitted";
  if (status === 3) return "released";
  if (status === 4) return "disputed";
  if (status === 5) {
    if (releasedAmount === 0n && amount > 0n) return "refunded";
    return "resolved";
  }
  return "pending";
}

export function mergeOnchainAgreement(
  local: Agreement,
  onchain: OnchainAgreementView | null,
): Agreement {
  if (!onchain) return local;
  const milestones: Milestone[] = onchain.milestones.map((remote, index) => {
    const localMilestone = local.milestones[index];
    const amount = remote.amount.toString();
    let evidence: EvidenceRecord | undefined = localMilestone?.evidence;
    if (remote.evidenceHash !== `0x${"0".repeat(64)}`) {
      evidence = {
        description:
          localMilestone?.evidence?.description ??
          "Evidence hash recorded on-chain. The file is not hosted by PactRail.",
        uri: remote.evidenceUri || undefined,
        hash: remote.evidenceHash.slice(2),
        submittedAt:
          remote.submittedAt > 0n
            ? new Date(Number(remote.submittedAt) * 1000).toISOString()
            : localMilestone?.evidence?.submittedAt ?? local.createdAt,
        submittedByRole: "payee",
        submittedByLabel: local.payee.name,
        fileName: localMilestone?.evidence?.fileName,
        fileSize: localMilestone?.evidence?.fileSize,
        mimeType: localMilestone?.evidence?.mimeType,
      };
    }
    return {
      id: localMilestone?.id ?? `onchain_${local.id}_${index}`,
      index,
      description:
        localMilestone?.description ??
        `Milestone ${index + 1} (description stored off-chain)`,
      acceptanceCriteria:
        localMilestone?.acceptanceCriteria ??
        "Acceptance criteria are stored in the approved off-chain terms.",
      amountBaseUnits: amount,
      dueAt:
        remote.dueAt > 0n
          ? new Date(Number(remote.dueAt) * 1000).toISOString()
          : localMilestone?.dueAt ?? local.createdAt,
      status: mapMilestoneStatus(remote.status, remote.releasedAmount, remote.amount),
      submittedAt:
        remote.submittedAt > 0n
          ? new Date(Number(remote.submittedAt) * 1000).toISOString()
          : undefined,
      evidence,
      dispute: localMilestone?.dispute,
      releasedAmountBaseUnits: remote.releasedAmount.toString(),
      refundedAmountBaseUnits: remote.refundedAmount.toString(),
      resolvedAt:
        remote.resolvedAt > 0n
          ? new Date(Number(remote.resolvedAt) * 1000).toISOString()
          : undefined,
    };
  });

  const completed = onchain.status === 3;
  return {
    ...local,
    milestones,
    fundedAt:
      onchain.fundedAt > 0n
        ? new Date(Number(onchain.fundedAt) * 1000).toISOString()
        : local.fundedAt,
    completedAt: completed
      ? local.completedAt ?? new Date(Number(onchain.fundedAt) * 1000).toISOString()
      : local.completedAt,
  };
}

function friendlyError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (/User rejected|User denied|rejected the request/i.test(message)) {
    return new Error("The wallet rejected the transaction. No funds moved.");
  }
  if (/insufficient funds|exceeds balance/i.test(message)) {
    return new Error("The connected account does not have enough testnet funds.");
  }
  if (/chain mismatch|does not match the target chain/i.test(message)) {
    return new Error("Switch the wallet to the agreement's network and try again.");
  }
  const firstLine = message.split("\n")[0];
  return new Error(firstLine.slice(0, 220) || "The transaction could not be completed.");
}

export function useEscrowActions() {
  const { writeContractAsync } = useWriteContract();
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId });

  const requireContext = useCallback(
    (expectedChainId: number) => {
      if (!address) throw new Error("Connect a wallet first.");
      if (!publicClient) throw new Error("No RPC client is available for this network.");
      if (chainId !== expectedChainId) {
        throw new Error("Switch the wallet to the agreement's network and try again.");
      }
    },
    [address, chainId, publicClient],
  );

  const wait = useCallback(
    async (hash: Hash): Promise<TransactionReceipt> => {
      if (!publicClient) throw new Error("No RPC client is available.");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        throw new Error("The transaction reverted on-chain. No state change was applied.");
      }
      return receipt;
    },
    [publicClient],
  );

  const createAgreement = useCallback(
    async (draft: AgreementDraft, termsHash: `0x${string}`, expectedChainId: number) => {
      requireContext(expectedChainId);
      const network = networkFor(expectedChainId);
      if (!network?.escrowAddress) throw new Error("Escrow contract is not configured for this network.");
      if (!network.tokenAddress) throw new Error("Test token is not configured for this network.");
      if (!address || !publicClient) throw new Error("Connect a wallet first.");

      const dueAts = draft.milestones.map((milestone) =>
        BigInt(Math.floor(new Date(milestone.dueAt).getTime() / 1000)),
      );
      const amounts = draft.milestones.map((milestone) => BigInt(milestone.amountBaseUnits));

      try {
        const hash = await writeContractAsync({
          abi: escrowAbi,
          address: network.escrowAddress,
          functionName: "createAgreement",
          args: [
            draft.payee.address as `0x${string}`,
            draft.arbitrator.address as `0x${string}`,
            network.tokenAddress,
            BigInt(draft.totalAmountBaseUnits),
            termsHash,
            dueAts,
            amounts,
          ],
          chainId: expectedChainId,
          account: address,
        });
        const receipt = await wait(hash);
        const logs = parseEventLogs({
          abi: escrowAbi,
          eventName: "AgreementCreated",
          logs: receipt.logs,
        });
        const created = logs[0];
        if (!created) throw new Error("AgreementCreated event was not found in the receipt.");
        return {
          txHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber.toString(),
          onchainAgreementId: Number(created.args.agreementId),
        };
      } catch (error) {
        throw friendlyError(error);
      }
    },
    [address, publicClient, requireContext, wait, writeContractAsync],
  );

  const fund = useCallback(
    async (agreement: Agreement) => {
      const chainRef = agreement.chain;
      const network = networkFor(chainRef?.chainId);
      if (!chainRef || !network?.escrowAddress || !network.tokenAddress) {
        throw new Error("This agreement is not linked to a configured escrow.");
      }
      requireContext(chainRef.chainId);
      if (!address || !publicClient) throw new Error("Connect a wallet first.");
      const amount = BigInt(agreement.totalAmountBaseUnits);

      try {
        const allowance = await publicClient.readContract({
          abi: erc20Abi,
          address: network.tokenAddress,
          functionName: "allowance",
          args: [address, network.escrowAddress],
        });
        let approveHash: `0x${string}` | undefined;
        if (allowance < amount) {
          approveHash = await writeContractAsync({
            abi: erc20Abi,
            address: network.tokenAddress,
            functionName: "approve",
            args: [network.escrowAddress, amount],
            chainId: chainRef.chainId,
            account: address,
          });
          await wait(approveHash);
        }
        const hash = await writeContractAsync({
          abi: escrowAbi,
          address: network.escrowAddress,
          functionName: "fundAgreement",
          args: [BigInt(chainRef.onchainAgreementId)],
          chainId: chainRef.chainId,
          account: address,
        });
        const receipt = await wait(hash);
        return {
          txHash: receipt.transactionHash,
          approveHash,
          blockNumber: receipt.blockNumber.toString(),
        };
      } catch (error) {
        throw friendlyError(error);
      }
    },
    [address, publicClient, requireContext, wait, writeContractAsync],
  );

  const submitEvidence = useCallback(
    async (agreement: Agreement, milestone: Milestone, evidence: EvidenceRecord) => {
      const chainRef = agreement.chain;
      const network = networkFor(chainRef?.chainId);
      if (!chainRef || !network?.escrowAddress) throw new Error("Agreement is not linked to an escrow.");
      requireContext(chainRef.chainId);
      if (!address) throw new Error("Connect a wallet first.");
      if (!/^[0-9a-fA-F]{64}$/.test(evidence.hash)) {
        throw new Error("Evidence hash must be a 32-byte SHA-256 digest.");
      }
      try {
        const hash = await writeContractAsync({
          abi: escrowAbi,
          address: chainRef.contractAddress,
          functionName: "submitMilestoneEvidence",
          args: [
            BigInt(chainRef.onchainAgreementId),
            BigInt(milestone.index),
            `0x${evidence.hash}`,
            evidence.uri ?? "",
          ],
          chainId: chainRef.chainId,
          account: address,
        });
        const receipt = await wait(hash);
        return { txHash: receipt.transactionHash, blockNumber: receipt.blockNumber.toString() };
      } catch (error) {
        throw friendlyError(error);
      }
    },
    [address, requireContext, wait, writeContractAsync],
  );

  const approve = useCallback(
    async (agreement: Agreement, milestone: Milestone) => {
      const chainRef = agreement.chain;
      if (!chainRef) throw new Error("Agreement is not linked to an escrow.");
      requireContext(chainRef.chainId);
      if (!address) throw new Error("Connect a wallet first.");
      try {
        const hash = await writeContractAsync({
          abi: escrowAbi,
          address: chainRef.contractAddress,
          functionName: "approveMilestone",
          args: [BigInt(chainRef.onchainAgreementId), BigInt(milestone.index)],
          chainId: chainRef.chainId,
          account: address,
        });
        const receipt = await wait(hash);
        return { txHash: receipt.transactionHash, blockNumber: receipt.blockNumber.toString() };
      } catch (error) {
        throw friendlyError(error);
      }
    },
    [address, requireContext, wait, writeContractAsync],
  );

  const dispute = useCallback(
    async (agreement: Agreement, milestone: Milestone, reason: string) => {
      const chainRef = agreement.chain;
      if (!chainRef) throw new Error("Agreement is not linked to an escrow.");
      requireContext(chainRef.chainId);
      if (!address) throw new Error("Connect a wallet first.");
      try {
        const reasonHash = sha256(stringToBytes(reason));
        const hash = await writeContractAsync({
          abi: escrowAbi,
          address: chainRef.contractAddress,
          functionName: "raiseDispute",
          args: [BigInt(chainRef.onchainAgreementId), BigInt(milestone.index), reasonHash],
          chainId: chainRef.chainId,
          account: address,
        });
        const receipt = await wait(hash);
        return {
          txHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber.toString(),
          reasonHash,
        };
      } catch (error) {
        throw friendlyError(error);
      }
    },
    [address, requireContext, wait, writeContractAsync],
  );

  const resolve = useCallback(
    async (
      agreement: Agreement,
      milestone: Milestone,
      payeeAmountBaseUnits: string,
      payerRefundBaseUnits: string,
    ) => {
      const chainRef = agreement.chain;
      if (!chainRef) throw new Error("Agreement is not linked to an escrow.");
      requireContext(chainRef.chainId);
      if (!address) throw new Error("Connect a wallet first.");
      try {
        const hash = await writeContractAsync({
          abi: escrowAbi,
          address: chainRef.contractAddress,
          functionName: "resolveDispute",
          args: [
            BigInt(chainRef.onchainAgreementId),
            BigInt(milestone.index),
            BigInt(payeeAmountBaseUnits),
            BigInt(payerRefundBaseUnits),
          ],
          chainId: chainRef.chainId,
          account: address,
        });
        const receipt = await wait(hash);
        return { txHash: receipt.transactionHash, blockNumber: receipt.blockNumber.toString() };
      } catch (error) {
        throw friendlyError(error);
      }
    },
    [address, requireContext, wait, writeContractAsync],
  );

  return { createAgreement, fund, submitEvidence, approve, dispute, resolve };
}

export function useTokenBalance(
  chainId: number,
  tokenAddress: `0x${string}` | null,
  account?: `0x${string}`,
) {
  return useReadContract({
    abi: erc20Abi,
    address: tokenAddress ?? undefined,
    functionName: "balanceOf",
    args: account ? [account] : undefined,
    chainId,
    query: { enabled: Boolean(tokenAddress && account), refetchInterval: 8_000 },
  });
}
