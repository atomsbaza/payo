type PayoLogoProps = {
  size?: number
  className?: string
}

export function PayoLogo({ size = 32, className }: PayoLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Payo logo"
      role="img"
    >
      <defs>
        <linearGradient id="payo-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4F46E5" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="16" fill="url(#payo-grad)" />
      <path
        d="M12 10l8 6-8 6V10z"
        fill="white"
      />
    </svg>
  )
}
