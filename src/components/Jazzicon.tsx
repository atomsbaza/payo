'use client'

type JazziconProps = {
  address: string
  size?: number
}

/**
 * Generate a deterministic set of colors from an Ethereum address hash.
 * Uses a simple hash-to-color algorithm that maps hex pairs to hue values.
 */
export function generateColors(address: string): string[] {
  // Validate: must be 0x-prefixed 40-hex-char string
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return []
  }

  const hex = address.slice(2).toLowerCase()
  const colors: string[] = []

  // Take 5 color slices from the address (8 hex chars each = 40 total)
  for (let i = 0; i < 5; i++) {
    const slice = hex.slice(i * 8, i * 8 + 8)
    const num = parseInt(slice, 16)

    const hue = num % 360
    const sat = 50 + (num % 40) // 50-89%
    const lit = 40 + (num % 30) // 40-69%

    colors.push(`hsl(${hue}, ${sat}%, ${lit}%)`)
  }

  return colors
}

/**
 * Jazzicon — Wallet avatar component.
 * Renders a deterministic SVG avatar based on the wallet address.
 * Falls back to a gray default avatar for invalid addresses.
 */
export function Jazzicon({ address, size = 48 }: JazziconProps) {
  const colors = generateColors(address)

  // Fallback: gray avatar for invalid address
  if (colors.length === 0) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Default avatar"
      >
        <circle cx="50" cy="50" r="50" fill="#6B7280" />
        <circle cx="50" cy="38" r="16" fill="#9CA3AF" />
        <ellipse cx="50" cy="75" rx="28" ry="20" fill="#9CA3AF" />
      </svg>
    )
  }

  // Seed a simple deterministic value from the address for shape positioning
  const seed = parseInt(address.slice(2, 10), 16)

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`Avatar for ${address.slice(0, 6)}...${address.slice(-4)}`}
    >
      {/* Background circle */}
      <circle cx="50" cy="50" r="50" fill={colors[0]} />

      {/* Deterministic shapes based on address */}
      <circle
        cx={30 + (seed % 40)}
        cy={30 + ((seed >> 8) % 40)}
        r={15 + (seed % 15)}
        fill={colors[1]}
        opacity="0.8"
      />
      <rect
        x={10 + ((seed >> 4) % 40)}
        y={10 + ((seed >> 12) % 40)}
        width={20 + (seed % 20)}
        height={20 + ((seed >> 16) % 20)}
        fill={colors[2]}
        opacity="0.7"
        rx="4"
      />
      <circle
        cx={50 + ((seed >> 6) % 30)}
        cy={50 + ((seed >> 10) % 30)}
        r={10 + ((seed >> 2) % 12)}
        fill={colors[3]}
        opacity="0.75"
      />
      <circle
        cx={20 + ((seed >> 14) % 60)}
        cy={20 + ((seed >> 18) % 60)}
        r={8 + ((seed >> 20) % 10)}
        fill={colors[4]}
        opacity="0.65"
      />
    </svg>
  )
}
