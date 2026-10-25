import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { advanceBuild } from '@/lib/pipeline/runner'
import { jsonError } from '@/lib/request'

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
  const view = await advanceBuild(await getDb(), id, { retry })
  if (!view) return jsonError(404, 'not_found', 'Build not found.')
  return NextResponse.json(view, { headers: { 'cache-control': 'no-store' } })
}
