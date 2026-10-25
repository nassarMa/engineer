import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { allowRate, createRestaurant, getUploads } from '@/lib/db/repo'
import { isVercel, setupProblems } from '@/lib/env'
import { clientIp, jsonError } from '@/lib/request'
import { restaurantInputSchema } from '@/lib/schemas'
import { telHref } from '@/lib/text'

export const runtime = 'nodejs'

/** Creates the restaurant record and its build; the client then drives the build via /advance. */
export async function POST(req: Request) {
  if (isVercel()) {
    const problems = setupProblems()
    if (problems.length) return jsonError(503, 'setup_incomplete', problems.join(' '))
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError(400, 'bad_json', 'Body must be JSON.')
  }
  const parsed = restaurantInputSchema.safeParse(body)
  if (!parsed.success) return jsonError(400, 'invalid', 'Some fields are invalid.', { issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) })
  const input = parsed.data
  if (!telHref(input.phone)) return jsonError(400, 'invalid', 'Phone number is not valid.', { issues: [{ path: 'phone', message: 'invalid' }] })
  if (input.logoMode === 'upload' && !input.logoUploadId) input.logoMode = 'none'
  if (input.logoMode !== 'upload') input.logoUploadId = null

  const db = await getDb()
  const ip = clientIp(req)
  if (!(await allowRate(db, `build:${ip}`, Number(process.env.BUILD_RATE_LIMIT ?? 6), 3600))) return jsonError(429, 'rate_limited', 'Too many websites were built from this connection recently.')
  if (!(await allowRate(db, 'build:global', Number(process.env.BUILD_DAILY_BUDGET ?? 200), 86400))) return jsonError(429, 'rate_limited', 'The daily build limit for this platform was reached. Please try again tomorrow.')

  // Every referenced upload must exist and be of the right kind.
  const wanted = [
    ...input.menuUploadIds.map((id) => ({ id, kind: 'menu' })),
    ...(input.logoUploadId ? [{ id: input.logoUploadId, kind: 'logo' }] : []),
    ...input.photoUploadIds.map((id) => ({ id, kind: 'photo' })),
  ]
  const rows = await getUploads(
    db,
    wanted.map((w) => w.id),
  )
  const byId = new Map(rows.map((r) => [r.id, r]))
  for (const w of wanted) {
    const row = byId.get(w.id)
    if (!row || row.kind !== w.kind) return jsonError(400, 'bad_upload', `Upload ${w.id} is missing or has the wrong type.`)
  }

  const { restaurant, build, ownerKey } = await createRestaurant(db, input)
  return NextResponse.json({ buildId: build.id, slug: restaurant.slug, ownerKey }, { status: 201 })
}
