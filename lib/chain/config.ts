import { defineChain, isAddress, type Chain } from "viem";
import { baseSepolia } from "viem/chains";

export const localAnvil = defineChain({
  id: 31_337,
  name: "Anvil Local",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_LOCAL_RPC_URL ?? "http://127.0.0.1:8545"],
    },
  },
  testnet: true,
});

export const supportedChains: [Chain, ...Chain[]] = [baseSepolia, localAnvil];

export interface NetworkConfig {
  chain: Chain;
  key: "base-sepolia" | "local";
  label: string;
  shortLabel: string;
  rpcUrl: string;
  explorerName: string | null;
  explorerBaseUrl: string | null;
  escrowAddress: `0x${string}` | null;
  tokenAddress: `0x${string}` | null;
  tokenSymbol: string;
  tokenDecimals: number;
  isLocal: boolean;
}

function address(value: string | undefined): `0x${string}` | null {
  if (!value || !isAddress(value)) return null;
  return value as `0x${string}`;
}

export const NETWORKS: Record<number, NetworkConfig> = {
  [baseSepolia.id]: {
    chain: baseSepolia,
    key: "base-sepolia",
    label: "Base Sepolia",
    shortLabel: "Base Sepolia",
    rpcUrl: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org",
    explorerName: "BaseScan Sepolia",
    explorerBaseUrl: "https://sepolia.basescan.org",
    escrowAddress: address(process.env.NEXT_PUBLIC_BASE_SEPOLIA_ESCROW),
    tokenAddress: address(process.env.NEXT_PUBLIC_BASE_SEPOLIA_TOKEN),
    tokenSymbol: process.env.NEXT_PUBLIC_BASE_SEPOLIA_TOKEN_SYMBOL ?? "USDC",
    tokenDecimals: Number(process.env.NEXT_PUBLIC_BASE_SEPOLIA_TOKEN_DECIMALS ?? "6"),
    isLocal: false,
  },
  [localAnvil.id]: {
    chain: localAnvil,
    key: "local",
    label: "Anvil Local",
    shortLabel: "Local",
    rpcUrl: process.env.NEXT_PUBLIC_LOCAL_RPC_URL ?? "http://127.0.0.1:8545",
    explorerName: null,
    explorerBaseUrl: null,
    escrowAddress: address(process.env.NEXT_PUBLIC_LOCAL_ESCROW),
    tokenAddress: address(process.env.NEXT_PUBLIC_LOCAL_TOKEN),
    tokenSymbol: process.env.NEXT_PUBLIC_LOCAL_TOKEN_SYMBOL ?? "pUSDC",
    tokenDecimals: Number(process.env.NEXT_PUBLIC_LOCAL_TOKEN_DECIMALS ?? "6"),
    isLocal: true,
  },
};

export function defaultChainId(): number {
  return process.env.NEXT_PUBLIC_DEFAULT_CHAIN === "local" ? localAnvil.id : baseSepolia.id;
}

export function networkFor(chainId?: number | null): NetworkConfig | null {
  if (!chainId) return null;
  return NETWORKS[chainId] ?? null;
}

export function chainDisplayName(chainId?: number | null): string {
  return networkFor(chainId)?.label ?? (chainId ? `Chain ${chainId}` : "No network");
}

export function txExplorerUrl(chainId: number | undefined, hash?: string): string | null {
  const network = networkFor(chainId);
  if (!network?.explorerBaseUrl || !hash) return null;
  return `${network.explorerBaseUrl}/tx/${hash}`;
}

export function addressExplorerUrl(
  chainId: number | undefined,
  address?: string | null,
): string | null {
  const network = networkFor(chainId);
  if (!network?.explorerBaseUrl || !address) return null;
  return `${network.explorerBaseUrl}/address/${address}`;
}

export function liveNetworkOptions(): NetworkConfig[] {
  return [NETWORKS[baseSepolia.id], NETWORKS[localAnvil.id]];
}
