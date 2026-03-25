import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: multi-chain-support, Property 1: Contract Registry Lookup Correctness
 *
 * For any chain ID and contract address string, if the environment variable
 * `NEXT_PUBLIC_CONTRACT_ADDRESS_{chainId}` is set to that value,
 * `getContractAddress(chainId)` must return the same value.
 * If no env var exists (and it's not the default chain with a legacy fallback),
 * it must return `undefined`.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 7.1**
 */

// --- Arbitraries ---

/** Positive chain IDs (realistic range, excluding default 84532 for the main property) */
const chainIdArb = fc.integer({ min: 1, max: 999_999 });

/** Hex address strings like 0x followed by 40 hex chars */
const addressArb = fc
  .array(fc.constantFrom(...'0123456789abcdef'.split('')), {
    minLength: 40,
    maxLength: 40,
  })
  .map((chars) => `0x${chars.join('')}`);

// --- Tests ---

describe('Feature: multi-chain-support, Property 1: Contract Registry Lookup Correctness', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    // Reset module cache so contractRegistry re-reads process.env
    vi.resetModules();
  });

  /**
   * When a per-chain env var is set, getContractAddress returns that value.
   * **Validates: Requirements 1.1, 1.2, 7.1**
   */
  it('returns the per-chain env var value when set', async () => {
    await fc.assert(
      fc.asyncProperty(chainIdArb, addressArb, async (chainId, address) => {
        vi.stubEnv(`NEXT_PUBLIC_CONTRACT_ADDRESS_${chainId}`, address);

        const { getContractAddress } = await import('../contractRegistry');
        const result = getContractAddress(chainId);

        expect(result).toBe(address);

        vi.unstubAllEnvs();
        vi.resetModules();
      }),
      { numRuns: 100 },
    );
  });

  /**
   * When no per-chain env var exists and chainId is not the default (84532),
   * getContractAddress returns undefined.
   * **Validates: Requirements 1.3**
   */
  it('returns undefined for chain IDs without an env var', async () => {
    await fc.assert(
      fc.asyncProperty(
        chainIdArb.filter((id) => id !== 84532),
        async (chainId) => {
          // Ensure no env var is set for this chain
          delete process.env[`NEXT_PUBLIC_CONTRACT_ADDRESS_${chainId}`];

          const { getContractAddress } = await import('../contractRegistry');
          const result = getContractAddress(chainId);

          expect(result).toBeUndefined();

          vi.resetModules();
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Per-chain env var takes precedence: setting both per-chain and legacy
   * for chain 84532 returns the per-chain value.
   * **Validates: Requirements 1.2, 7.1**
   */
  it('per-chain env var takes precedence over legacy for default chain', async () => {
    await fc.assert(
      fc.asyncProperty(addressArb, addressArb.filter((a, _) => true), async (perChainAddr, legacyAddr) => {
        fc.pre(perChainAddr !== legacyAddr);

        vi.stubEnv('NEXT_PUBLIC_CONTRACT_ADDRESS_84532', perChainAddr);
        vi.stubEnv('NEXT_PUBLIC_CONTRACT_ADDRESS', legacyAddr);

        const { getContractAddress } = await import('../contractRegistry');
        const result = getContractAddress(84532);

        expect(result).toBe(perChainAddr);

        vi.unstubAllEnvs();
        vi.resetModules();
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Feature: multi-chain-support, Property 2: Legacy Environment Variable Fallback
 *
 * For any contract address string, when only `NEXT_PUBLIC_CONTRACT_ADDRESS` (legacy)
 * is set (without a per-chain variable for chain 84532),
 * `getContractAddress(84532)` must return the legacy value.
 * `getContractAddress(otherChainId)` for any other chain ID without a per-chain var
 * must return `undefined`.
 *
 * **Validates: Requirements 7.2**
 */

describe('Feature: multi-chain-support, Property 2: Legacy Environment Variable Fallback', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  /**
   * When only the legacy env var is set, getContractAddress(84532) returns the legacy value.
   * **Validates: Requirements 7.2**
   */
  it('returns legacy env var value for default chain 84532 when no per-chain var exists', async () => {
    await fc.assert(
      fc.asyncProperty(addressArb, async (legacyAddress) => {
        // Only set the legacy env var, NOT the per-chain one
        vi.stubEnv('NEXT_PUBLIC_CONTRACT_ADDRESS', legacyAddress);
        delete process.env['NEXT_PUBLIC_CONTRACT_ADDRESS_84532'];

        const { getContractAddress } = await import('../contractRegistry');
        const result = getContractAddress(84532);

        expect(result).toBe(legacyAddress);

        vi.unstubAllEnvs();
        vi.resetModules();
      }),
      { numRuns: 100 },
    );
  });

  /**
   * When only the legacy env var is set, getContractAddress(otherChainId) returns undefined
   * for any chain ID that is not 84532 and has no per-chain env var.
   * **Validates: Requirements 7.2**
   */
  it('returns undefined for non-default chain IDs even when legacy env var is set', async () => {
    await fc.assert(
      fc.asyncProperty(
        addressArb,
        chainIdArb.filter((id) => id !== 84532),
        async (legacyAddress, otherChainId) => {
          // Only set the legacy env var
          vi.stubEnv('NEXT_PUBLIC_CONTRACT_ADDRESS', legacyAddress);
          // Ensure no per-chain var for this chain
          delete process.env[`NEXT_PUBLIC_CONTRACT_ADDRESS_${otherChainId}`];

          const { getContractAddress } = await import('../contractRegistry');
          const result = getContractAddress(otherChainId);

          expect(result).toBeUndefined();

          vi.unstubAllEnvs();
          vi.resetModules();
        },
      ),
      { numRuns: 100 },
    );
  });
});
