import { createConfig, http, injected } from "wagmi";
import { baseSepolia } from "viem/chains";
import { localAnvil, NETWORKS } from "@/lib/chain/config";

export const wagmiConfig = createConfig({
  chains: [baseSepolia, localAnvil],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [baseSepolia.id]: http(NETWORKS[baseSepolia.id].rpcUrl),
    [localAnvil.id]: http(NETWORKS[localAnvil.id].rpcUrl),
  },
  ssr: true,
});
