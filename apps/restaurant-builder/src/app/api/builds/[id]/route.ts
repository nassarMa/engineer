import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { viewBuild } from '@/lib/pipeline/runner'
import { jsonError } from '@/lib/request'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const view = await viewBuild(await getDb(), id)
  if (!view) return jsonError(404, 'not_found', 'Build not found.')
  return NextResponse.json(view, { headers: { 'cache-control': 'no-store' } })
}
