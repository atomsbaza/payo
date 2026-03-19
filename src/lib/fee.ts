/**
 * Fee calculation utilities for CryptoPayLink transaction fees.
 * Uses BigInt arithmetic to match Solidity integer division exactly.
 */

/** Maximum fee rate: 1000 basis points = 10% */
export const MAX_FEE_RATE = 1000n;

/** Total basis points representing 100% */
export const BASIS_POINTS = 10000n;

/**
 * Validates that a fee rate is within the allowed range (0–1000 basis points).
 * Throws if the fee rate is negative or exceeds MAX_FEE_RATE.
 */
export function validateFeeRate(feeRate: bigint): void {
  if (feeRate < 0n) {
    throw new RangeError(`Fee rate must be non-negative, got ${feeRate}`);
  }
  if (feeRate > MAX_FEE_RATE) {
    throw new RangeError(
      `Fee rate exceeds maximum of ${MAX_FEE_RATE} basis points, got ${feeRate}`
    );
  }
}

/**
 * Calculates the fee and net amount for a given payment amount and fee rate.
 * Uses integer division: fee = (amount * feeRate) / 10000
 *
 * @param amount  - Payment amount in smallest unit (wei / token decimals)
 * @param feeRate - Fee rate in basis points (0–1000)
 * @returns Object with `fee` and `net` amounts where fee + net === amount
 */
export function calculateFee(
  amount: bigint,
  feeRate: bigint
): { fee: bigint; net: bigint } {
  validateFeeRate(feeRate);
  const fee = (amount * feeRate) / BASIS_POINTS;
  return { fee, net: amount - fee };
}

/**
 * Formats a fee rate in basis points as a human-readable percentage string.
 * Examples: 100n → "1%", 50n → "0.5%", 1n → "0.01%", 0n → "0%"
 */
export function formatFeePercent(feeRate: bigint): string {
  // feeRate is in basis points where 10000 = 100%, so 100 = 1%
  // We need to divide by 100 to get the percentage value.
  const whole = feeRate / 100n;
  const remainder = feeRate % 100n;

  if (remainder === 0n) {
    return `${whole}%`;
  }

  // Build decimal part: remainder out of 100
  // e.g. remainder=50 → ".5", remainder=1 → ".01"
  const decimalStr = remainder.toString().padStart(2, "0");
  // Trim trailing zeros
  const trimmed = decimalStr.replace(/0+$/, "");
  return `${whole}.${trimmed}%`;
}
