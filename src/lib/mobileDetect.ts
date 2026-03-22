/**
 * Mobile and in-app wallet browser detection utilities.
 *
 * Exports both navigator-based versions (for use in components) and
 * pure UA-string versions (for easy property-based testing).
 */

/** Detect in-app wallet browser from a raw user-agent string. */
export function isInAppBrowserUA(ua: string): boolean {
  return /MetaMask|Trust|Coinbase|Rainbow/i.test(ua)
}

/** Detect mobile browser (not in-app wallet) from a raw user-agent string. */
export function isMobileBrowserUA(ua: string): boolean {
  return /Android|iPhone|iPad|iPod/i.test(ua) && !isInAppBrowserUA(ua)
}

/** Detect in-app wallet browser using `navigator.userAgent`. */
export function isInAppBrowser(): boolean {
  if (typeof window === 'undefined') return false
  return isInAppBrowserUA(navigator.userAgent)
}

/** Detect mobile browser (not in-app wallet) using `navigator.userAgent`. */
export function isMobileBrowser(): boolean {
  if (typeof window === 'undefined') return false
  return isMobileBrowserUA(navigator.userAgent)
}
