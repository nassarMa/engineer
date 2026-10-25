import { NextRequest, NextResponse } from 'next/server'

/**
 * Multi-tenant routing: `<slug>.<PLATFORM_DOMAIN>` serves `/r/<slug>`.
 * The apex and `www` keep serving the builder.
 */
export function proxy(req: NextRequest) {
  const domain = process.env.PLATFORM_DOMAIN?.trim().toLowerCase().replace(/^\.+|\.+$/g, '')
  if (!domain) return NextResponse.next()
  const host = (req.headers.get('host') ?? '').toLowerCase().split(':')[0]
  if (!host.endsWith(`.${domain}`)) return NextResponse.next()
  const sub = host.slice(0, -(domain.length + 1))
  if (!sub || sub === 'www' || sub.includes('.')) return NextResponse.next()
  if (!/^[a-z0-9-]{1,60}$/.test(sub)) return NextResponse.next()
  const url = req.nextUrl.clone()
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/')) return NextResponse.next()
  url.pathname = url.pathname === '/' ? `/r/${sub}` : `/r/${sub}${url.pathname}`
  return NextResponse.rewrite(url)
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
