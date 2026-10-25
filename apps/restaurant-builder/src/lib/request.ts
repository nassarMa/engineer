import { NextResponse } from 'next/server'

/**
 * Client address for rate limiting. Forwarded headers are only trusted on
 * Vercel (which sets them itself) or when TRUST_PROXY=1 is set behind your own
 * reverse proxy; otherwise anyone could pick their own bucket.
 */
export function clientIp(req: Request): string {
  const trust = process.env.VERCEL === '1' || process.env.TRUST_PROXY === '1'
  if (trust) {
    const fwd = req.headers.get('x-forwarded-for')
    if (fwd) return fwd.split(',')[0].trim()
    const real = req.headers.get('x-real-ip')
    if (real) return real
  }
  return 'direct'
}

export function jsonError(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status })
}
