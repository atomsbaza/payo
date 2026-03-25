import { configVariable, defineConfig } from "hardhat/config";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

export default defineConfig({
  solidity: {
    profiles: {
      default: {
        version: "0.8.20",
      },
      production: {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    baseSepolia: {
      type: "http",
      chainType: "l1",
      url: "https://sepolia.base.org",
      accounts: [configVariable("DEPLOYER_PRIVATE_KEY")],
    },
    base: {
      type: "http",
      chainType: "l1",
      url: "https://mainnet.base.org",
      accounts: [configVariable("DEPLOYER_PRIVATE_KEY")],
    },
    optimism: {
      type: "http",
      chainType: "l1",
      url: "https://mainnet.optimism.io",
      accounts: [configVariable("DEPLOYER_PRIVATE_KEY")],
    },
    arbitrumOne: {
      type: "http",
      chainType: "l1",
      url: "https://arb1.arbitrum.io/rpc",
      accounts: [configVariable("DEPLOYER_PRIVATE_KEY")],
    },
  },
});
