import { createWalletClient, createPublicClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

const baseSepolia = defineChain({
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://sepolia.base.org"] } },
});

async function main() {
  const companyWallet = "0x8E21cAb519316324B36CE0b9b43E76a578Afd1b0";
  const feeRate = 100; // 1% in basis points

  const account = privateKeyToAccount(`0x${PRIVATE_KEY.replace(/^0x/, "")}`);
  console.log("Deployer:", account.address);

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  });

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  // Read compiled artifact
  const artifactPath = resolve(
    __dirname,
    "../artifacts/contracts/CryptoPayLinkFee.sol/CryptoPayLinkFee.json"
  );
  let artifact;
  try {
    artifact = JSON.parse(readFileSync(artifactPath, "utf-8"));
  } catch {
    console.error("Contract not compiled. Run: npx hardhat compile");
    process.exit(1);
  }

  console.log("Deploying CryptoPayLinkFee...");
  console.log("  Company wallet:", companyWallet);
  console.log("  Fee rate:", feeRate, "bp (1%)");

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode as `0x${string}`,
    args: [companyWallet, feeRate],
  });

  console.log("Tx hash:", hash);
  console.log("Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const address = receipt.contractAddress;

  console.log("\n✅ CryptoPayLinkFee deployed to:", address);
  console.log("\nAdd this to your .env.local:");
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
