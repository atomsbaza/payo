/**
 * set-fee-rate.ts
 * Calls setFeeRate(newRate) on the deployed CryptoPayLinkFee contract as the owner.
 *
 * Usage:
 *   npx tsx scripts/set-fee-rate.ts <network> <basisPoints>
 *
 * Examples:
 *   npx tsx scripts/set-fee-rate.ts baseSepolia 0    # set to 0%
 *   npx tsx scripts/set-fee-rate.ts base 50          # set to 0.5%
 */

import { createWalletClient, createPublicClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { CryptoPayLinkFeeABI } from "../src/lib/contract.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const NETWORKS: Record<string, { id: number; name: string; rpcUrl: string }> = {
  baseSepolia: { id: 84532, name: "Base Sepolia", rpcUrl: "https://sepolia.base.org" },
  base:        { id: 8453,  name: "Base Mainnet", rpcUrl: "https://mainnet.base.org" },
  optimism:    { id: 10,    name: "Optimism",     rpcUrl: "https://mainnet.optimism.io" },
  arbitrumOne: { id: 42161, name: "Arbitrum One", rpcUrl: "https://arb1.arbitrum.io/rpc" },
};

const networkName = process.argv[2];
const newRateArg = process.argv[3];

if (!networkName || !NETWORKS[networkName]) {
  console.error("Usage: npx tsx scripts/set-fee-rate.ts <network> <basisPoints>");
  console.error("Available networks:", Object.keys(NETWORKS).join(", "));
  process.exit(1);
}

if (newRateArg === undefined || isNaN(Number(newRateArg))) {
  console.error("Error: basisPoints must be a number (e.g. 0 for 0%, 100 for 1%)");
  process.exit(1);
}

const newRate = BigInt(newRateArg);
if (newRate > 1000n) {
  console.error("Error: basisPoints cannot exceed 1000 (10%)");
  process.exit(1);
}

const network = NETWORKS[networkName];

// Load .env.local
const envPath = resolve(__dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf-8");
const env: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const [key, ...rest] = trimmed.split("=");
  env[key] = rest.join("=").replace(/^["']|["']$/g, "");
}

const PRIVATE_KEY = env.DEPLOYER_PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error("Missing DEPLOYER_PRIVATE_KEY in .env.local");
  process.exit(1);
}

const contractAddress = (
  env[`NEXT_PUBLIC_CONTRACT_ADDRESS_${network.id}`] ||
  (network.id === 84532 ? env["NEXT_PUBLIC_CONTRACT_ADDRESS"] : undefined)
) as `0x${string}` | undefined;

if (!contractAddress) {
  console.error(`Missing NEXT_PUBLIC_CONTRACT_ADDRESS_${network.id} in .env.local`);
  process.exit(1);
}

const chain = defineChain({
  id: network.id,
  name: network.name,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [network.rpcUrl] } },
});

async function main() {
  const account = privateKeyToAccount(`0x${PRIVATE_KEY.replace(/^0x/, "")}`);
  console.log("Deployer:", account.address);
  console.log("Network:", network.name, `(chain ID: ${network.id})`);
  console.log("Contract:", contractAddress);
  console.log(`Setting fee rate to ${newRate} bp (${Number(newRate) / 100}%)`);

  const walletClient = createWalletClient({ account, chain, transport: http() });
  const publicClient = createPublicClient({ chain, transport: http() });

  const hash = await walletClient.writeContract({
    address: contractAddress!,
    abi: CryptoPayLinkFeeABI,
    functionName: "setFeeRate",
    args: [newRate],
  });

  console.log("Tx hash:", hash);
  console.log("Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`\n✅ Fee rate updated to ${newRate} bp on ${network.name}`);
  console.log("   Block:", receipt.blockNumber);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
