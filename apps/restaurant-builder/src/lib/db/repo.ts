import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { Db } from './index'
import type { Brand, Content, Design, ExtractedMenu, Locale, RestaurantInput, RestaurantUpdate, SiteConfig, Stage, BuildStatus } from '../schemas'
import { isReservedSlug, randomSuffix, slugify } from '../text'

export type UploadRow = {
  id: string
  kind: 'menu' | 'logo' | 'photo'
  mime: string
  bytes: number
  width: number | null
  height: number | null
  storage_key: string
  url: string
}

export type RestaurantRow = {
  id: string
  slug: string
  name: string
  phone: string
  address: string
  description: string
  website_lang: Locale
  builder_locale: Locale
  logo_mode: 'none' | 'upload' | 'in-menu'
  logo_upload_id: string | null
  menu_upload_ids: string[]
  photo_upload_ids: string[]
  owner_key_hash: string
  preview_token: string
  status: 'draft' | 'building' | 'published' | 'failed'
  extracted_menu: ExtractedMenu | null
  brand: Brand | null
  design: Design | null
  content: Content | null
  site_config: SiteConfig | null
  qa_report: unknown
  published_url: string | null
  published_at: string | null
  verified_at: string | null
}

export type BuildRow = {
  id: string
  restaurant_id: string
  stage: Stage
  status: BuildStatus
  attempt: number
  error: string | null
  log: { stage: string; at: string; ms: number; note?: string }[]
  locked_at: string | null
}

export function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

export function newOwnerKey(): string {
  return randomBytes(18).toString('base64url')
}

export async function insertUpload(db: Db, row: Omit<UploadRow, 'id'> & { ip: string | null }): Promise<UploadRow> {
  const id = randomUUID()
  await db.query(
    `INSERT INTO uploads (id, kind, mime, bytes, width, height, storage_key, url, ip) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, row.kind, row.mime, row.bytes, row.width, row.height, row.storage_key, row.url, row.ip],
  )
  return { id, ...row }
}

export async function getUploads(db: Db, ids: string[]): Promise<UploadRow[]> {
  if (ids.length === 0) return []
  const rows = await db.query<UploadRow>(`SELECT * FROM uploads WHERE id = ANY($1::text[])`, [ids])
  // keep caller order
  const byId = new Map(rows.map((r) => [r.id, r]))
  return ids.map((id) => byId.get(id)).filter((r): r is UploadRow => Boolean(r))
}

/** Reserve a unique slug: name-derived, suffixed on collision. */
export async function reserveSlug(db: Db, name: string): Promise<string> {
  let base = slugify(name)
  if (!base || isReservedSlug(base)) base = `restaurant-${randomSuffix(5)}`
  for (let i = 0; i < 6; i++) {
    const candidate = i === 0 ? base : `${base}-${randomSuffix(3)}`
    const taken = await db.query(`SELECT 1 FROM restaurants WHERE slug = $1`, [candidate])
    if (taken.length === 0) return candidate
  }
  return `${base}-${randomSuffix(6)}`
}

export async function createRestaurant(db: Db, input: RestaurantInput): Promise<{ restaurant: RestaurantRow; build: BuildRow; ownerKey: string }> {
  const id = randomUUID()
  const slug = await reserveSlug(db, input.name)
  const ownerKey = newOwnerKey()
  const previewToken = randomBytes(12).toString('base64url')
  await db.query(
    `INSERT INTO restaurants (id, slug, name, phone, address, description, website_lang, builder_locale, logo_mode, logo_upload_id, menu_upload_ids, photo_upload_ids, owner_key_hash, preview_token, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'building')`,
    [id, slug, input.name, input.phone, input.address, input.description, input.websiteLang, input.locale, input.logoMode, input.logoUploadId, JSON.stringify(input.menuUploadIds), JSON.stringify(input.photoUploadIds), hashKey(ownerKey), previewToken],
  )
  const buildId = randomUUID()
  await db.query(`INSERT INTO builds (id, restaurant_id) VALUES ($1,$2)`, [buildId, id])
  const restaurant = (await getRestaurantById(db, id))!
  const build = (await getBuild(db, buildId))!
  return { restaurant, build, ownerKey }
}

export async function getRestaurantById(db: Db, id: string): Promise<RestaurantRow | null> {
  const rows = await db.query<RestaurantRow>(`SELECT * FROM restaurants WHERE id = $1`, [id])
  return rows[0] ?? null
}

export async function getRestaurantBySlug(db: Db, slug: string): Promise<RestaurantRow | null> {
  const rows = await db.query<RestaurantRow>(`SELECT * FROM restaurants WHERE slug = $1`, [slug])
  return rows[0] ?? null
}

export async function updateRestaurant(db: Db, id: string, patch: Partial<Record<keyof RestaurantRow, unknown>>): Promise<void> {
  const keys = Object.keys(patch)
  if (keys.length === 0) return
  const sets = keys.map((k, i) => `${k} = $${i + 2}`)
  const values = keys.map((k) => {
    const v = (patch as Record<string, unknown>)[k]
    return v !== null && typeof v === 'object' ? JSON.stringify(v) : v
  })
  await db.query(`UPDATE restaurants SET ${sets.join(', ')}, updated_at = now() WHERE id = $1`, [id, ...values])
}

export async function updateBasics(db: Db, id: string, update: RestaurantUpdate): Promise<void> {
  await updateRestaurant(db, id, { name: update.name, phone: update.phone, address: update.address, description: update.description })
}

export function verifyOwnerKey(restaurant: RestaurantRow, key: string | null | undefined): boolean {
  if (!key) return false
  return hashKey(key) === restaurant.owner_key_hash
}

export async function getBuild(db: Db, id: string): Promise<BuildRow | null> {
  const rows = await db.query<BuildRow>(`SELECT * FROM builds WHERE id = $1`, [id])
  return rows[0] ?? null
}

export async function latestBuildForRestaurant(db: Db, restaurantId: string): Promise<BuildRow | null> {
  const rows = await db.query<BuildRow>(`SELECT * FROM builds WHERE restaurant_id = $1 ORDER BY created_at DESC LIMIT 1`, [restaurantId])
  return rows[0] ?? null
}

/**
 * Take the build lock. Returns the row when this caller owns it; null when another
 * request is already running a stage (locks older than 5 minutes are considered dead).
 */
export async function lockBuild(db: Db, id: string, retry: boolean): Promise<BuildRow | null> {
  const rows = await db.query<BuildRow>(
    `UPDATE builds SET locked_at = now(), status = 'running', updated_at = now(),
       error = CASE WHEN $2 THEN NULL ELSE error END,
       attempt = CASE WHEN $2 THEN attempt + 1 ELSE attempt END
     WHERE id = $1
       AND (locked_at IS NULL OR locked_at < now() - interval '5 minutes')
       AND (status = 'waiting' OR ($2 AND status = 'failed') OR (status = 'running' AND locked_at < now() - interval '5 minutes'))
     RETURNING *`,
    [id, retry],
  )
  return rows[0] ?? null
}

export async function finishStage(db: Db, id: string, next: Stage, note: { stage: string; ms: number; note?: string }): Promise<void> {
  const status: BuildStatus = next === 'done' ? 'done' : 'waiting'
  await db.query(
    `UPDATE builds SET stage = $2, status = $3, locked_at = NULL, error = NULL, updated_at = now(),
       log = log || $4::jsonb
     WHERE id = $1`,
    [id, next, status, JSON.stringify([{ ...note, at: new Date().toISOString() }])],
  )
}

export async function failStage(db: Db, id: string, error: string): Promise<void> {
  await db.query(`UPDATE builds SET status = 'failed', locked_at = NULL, error = $2, updated_at = now() WHERE id = $1`, [id, error.slice(0, 1000)])
}

/** Fixed-window rate limit; true when the caller is within the limit. */
export async function allowRate(db: Db, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const rows = await db.query<{ count: number }>(
    `INSERT INTO rate_limits (key, window_start, count) VALUES ($1, now(), 1)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start < now() - ($2 || ' seconds')::interval THEN 1 ELSE rate_limits.count + 1 END,
       window_start = CASE WHEN rate_limits.window_start < now() - ($2 || ' seconds')::interval THEN now() ELSE rate_limits.window_start END
     RETURNING count`,
    [key, String(windowSeconds)],
  )
  return (rows[0]?.count ?? 0) <= limit
}
