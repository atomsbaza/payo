import { NextResponse, type NextRequest } from 'next/server'

const GEO_BLOCKED_COUNTRY = 'TH'

const PAYMENT_ROUTES = [
  '/create',
  '/pay',
  '/u',
  '/api/links',
  '/api/fees',
  '/api/tx',
]

function isPaymentRoute(pathname: string): boolean {
  return PAYMENT_ROUTES.some(route => pathname.startsWith(route))
}

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/dashboard/fees')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  const country = request.headers.get('x-vercel-ip-country')
  if (country === GEO_BLOCKED_COUNTRY && isPaymentRoute(request.nextUrl.pathname)) {
    return new NextResponse(
      JSON.stringify({ error: 'Service not available in your region.' }),
      {
        status: 451,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  const response = NextResponse.next()

  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  )
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "connect-src 'self' https://*.walletconnect.com https://*.walletconnect.org wss://*.walletconnect.com wss://*.walletconnect.org https://api-sepolia.basescan.org https://*.web3modal.org https://*.web3modal.com https://sepolia.base.org https://*.base.org https://*.infura.io https://*.alchemy.com wss://*.infura.io wss://*.alchemy.com; " +
    "img-src 'self' data: https: blob:; " +
    "font-src 'self' data:; " +
    "frame-src 'self' https://*.walletconnect.com;"
  )

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
