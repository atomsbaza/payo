import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { NETWORKS, getNetworkConfig } from '../deploy';

/**
 * Feature: multi-chain-support, Property 6: Deploy Script Network Selection
 *
 * For any network name that exists in the NETWORKS map of the deploy script,
 * the script must select a chain definition whose chain ID matches that network name.
 *
 * **Validates: Requirements 6.1, 6.4**
 */

// --- Expected mapping (source of truth from NETWORKS) ---

const EXPECTED_CHAIN_IDS: Record<string, number> = {
  baseSepolia: 84532,
  base: 8453,
  optimism: 10,
  arbitrumOne: 42161,
};

const validNetworkNames = Object.keys(NETWORKS);

// --- Arbitraries ---

/** Pick a valid network name from the NETWORKS map keys */
const validNetworkArb = fc.constantFrom(...validNetworkNames);

/** Generate strings that are NOT valid network names */
const invalidNetworkArb = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => !(s in NETWORKS));

// --- Tests ---

describe('Feature: multi-chain-support, Property 6: Deploy Script Network Selection', () => {
  /**
   * For any valid network name, getNetworkConfig returns a config
   * whose chain ID matches the expected mapping.
   * **Validates: Requirements 6.1, 6.4**
   */
  it('returns config with correct chain ID for every valid network name', () => {
    fc.assert(
      fc.property(validNetworkArb, (networkName) => {
        const config = getNetworkConfig(networkName);

        // Config must be defined for valid network names
        expect(config).toBeDefined();
        // Chain ID must match the expected mapping
        expect(config!.id).toBe(EXPECTED_CHAIN_IDS[networkName]);
        // Name and rpcUrl must be non-empty strings
        expect(config!.name).toBeTruthy();
        expect(config!.rpcUrl).toBeTruthy();
      }),
      { numRuns: 100 },
    );
  });

  /**
   * For any invalid network name, getNetworkConfig returns undefined.
   * **Validates: Requirements 6.1**
   */
  it('returns undefined for invalid network names', () => {
    fc.assert(
      fc.property(invalidNetworkArb, (networkName) => {
        const config = getNetworkConfig(networkName);
        expect(config).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });

  /**
   * The NETWORKS map covers all 4 supported chains exactly.
   * **Validates: Requirements 6.4**
   */
  it('NETWORKS map contains all supported chains', () => {
    expect(Object.keys(NETWORKS).sort()).toEqual(
      Object.keys(EXPECTED_CHAIN_IDS).sort(),
    );

    for (const [name, expectedId] of Object.entries(EXPECTED_CHAIN_IDS)) {
      expect(NETWORKS[name].id).toBe(expectedId);
    }
  });
});
