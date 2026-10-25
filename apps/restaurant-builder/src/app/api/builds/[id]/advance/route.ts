import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { allowRate } from '@/lib/db/repo'
import { advanceBuild } from '@/lib/pipeline/runner'
import { clientIp, jsonError } from '@/lib/request'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Runs one pipeline stage. Idempotent under concurrency; `{retry:true}` re-runs a failed stage. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  let retry = false
  try {
    const body = (await req.json()) as { retry?: boolean }
    retry = Boolean(body?.retry)
  } catch {
    /* no body */
  }
  if (!/^[0-9a-f-]{36}$/.test(id)) return jsonError(404, 'not_found', 'Build not found.')
  const db = await getDb()
  // A build has at most 7 stages; retries are capped in lockBuild. These limits bound AI spend per caller and per build.
  if (!(await allowRate(db, `advance:${id}`, 60, 3600)) || !(await allowRate(db, `advance-ip:${clientIp(req)}`, 600, 3600))) return jsonError(429, 'rate_limited', 'Too many requests.')
  const view = await advanceBuild(db, id, { retry })
  if (!view) return jsonError(404, 'not_found', 'Build not found.')
  return NextResponse.json(view, { headers: { 'cache-control': 'no-store' } })
}
