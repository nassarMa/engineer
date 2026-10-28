import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
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
  retryable: boolean
  locked_at: string | null
  lock_token: string | null
}

/** Locks older than this are considered dead. Must exceed the advance route's maxDuration (300 s). */
export const LOCK_TTL_SECONDS = 420

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
  // Ids are UUIDs (no commas); a joined string avoids driver-specific array encoding.
  const rows = await db.query<UploadRow>(`SELECT * FROM uploads WHERE id = ANY(string_to_array($1::text, ','))`, [ids.join(',')])
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
  const ownerKey = newOwnerKey()
  const previewToken = randomBytes(12).toString('base64url')
  // Two owners creating the same name at once can race on the unique slug; try again with a new suffix.
  for (let attempt = 0; ; attempt++) {
    const slug = await reserveSlug(db, input.name)
    try {
      await db.query(
        `INSERT INTO restaurants (id, slug, name, phone, address, description, website_lang, builder_locale, logo_mode, logo_upload_id, menu_upload_ids, photo_upload_ids, owner_key_hash, preview_token, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'building')`,
        [id, slug, input.name, input.phone, input.address, input.description, input.websiteLang, input.locale, input.logoMode, input.logoUploadId, input.menuUploadIds, input.photoUploadIds, hashKey(ownerKey), previewToken],
      )
      break
    } catch (e) {
      if (attempt >= 3 || !/unique|duplicate/i.test((e as Error).message)) throw e
    }
  }
  const buildId = randomUUID()
  await db.query(`INSERT INTO builds (id, restaurant_id) VALUES ($1,$2)`, [buildId, id])
  const restaurant = (await getRestaurantById(db, id))!
  const build = (await getBuild(db, buildId))!
  return { restaurant, build, ownerKey }
}

const RESTAURANT_JSON = ['menu_upload_ids', 'photo_upload_ids', 'extracted_menu', 'brand', 'design', 'content', 'site_config', 'qa_report'] as const
const BUILD_JSON = ['log'] as const

/** JSONB may come back parsed or as text depending on the driver and query path; make it always parsed. */
function parseJson<T extends object>(row: T | undefined, keys: readonly (keyof T)[]): T | null {
  if (!row) return null
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'string') (row as Record<keyof T, unknown>)[k] = JSON.parse(v)
  }
  return row
}

export async function getRestaurantById(db: Db, id: string): Promise<RestaurantRow | null> {
  const rows = await db.query<RestaurantRow>(`SELECT * FROM restaurants WHERE id = $1`, [id])
  return parseJson(rows[0], RESTAURANT_JSON)
}

export async function getRestaurantBySlug(db: Db, slug: string): Promise<RestaurantRow | null> {
  const rows = await db.query<RestaurantRow>(`SELECT * FROM restaurants WHERE slug = $1`, [slug])
  return parseJson(rows[0], RESTAURANT_JSON)
}

export async function updateRestaurant(db: Db, id: string, patch: Partial<Record<keyof RestaurantRow, unknown>>): Promise<void> {
  const keys = Object.keys(patch)
  if (keys.length === 0) return
  for (const k of keys) if (!/^[a-z_]+$/.test(k)) throw new Error(`bad column ${k}`)
  const sets = keys.map((k, i) => `${k} = $${i + 2}`)
  const values = keys.map((k) => (patch as Record<string, unknown>)[k])
  await db.query(`UPDATE restaurants SET ${sets.join(', ')}, updated_at = now() WHERE id = $1`, [id, ...values])
}

export async function updateBasics(db: Db, id: string, update: RestaurantUpdate): Promise<void> {
  await updateRestaurant(db, id, { name: update.name, phone: update.phone, address: update.address, description: update.description })
}

export function verifyOwnerKey(restaurant: RestaurantRow, key: string | null | undefined): boolean {
  if (!key) return false
  const a = Buffer.from(hashKey(key))
  const b = Buffer.from(restaurant.owner_key_hash)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function getBuild(db: Db, id: string): Promise<BuildRow | null> {
  const rows = await db.query<BuildRow>(`SELECT * FROM builds WHERE id = $1`, [id])
  return parseJson(rows[0], BUILD_JSON)
}

/**
 * Take the build lock. Returns the row (with the lock token in locked_at) when this
 * caller owns it; null when another request is already running a stage. A dead
 * lock (older than LOCK_TTL_SECONDS) is taken over and counts as a new attempt.
 */
export async function lockBuild(db: Db, id: string, retry: boolean): Promise<BuildRow | null> {
  const rows = await db.query<BuildRow>(
    `UPDATE builds SET locked_at = clock_timestamp(), lock_token = $5, status = 'running', updated_at = now(),
       error = CASE WHEN $2 THEN NULL ELSE error END,
       attempt = CASE WHEN $2 OR status = 'running' THEN attempt + 1 ELSE attempt END
     WHERE id = $1
       AND (locked_at IS NULL OR locked_at < now() - ($4 || ' seconds')::interval)
       AND (status = 'waiting' OR ($2 AND status = 'failed' AND retryable AND attempt < $3) OR (status = 'running' AND attempt < $3))
     RETURNING *`,
    [id, retry, MAX_ATTEMPTS, String(LOCK_TTL_SECONDS), randomUUID()],
  )
  return parseJson(rows[0], BUILD_JSON)
}

/** A build may be retried this many times in total; after that it stays failed. */
export const MAX_ATTEMPTS = 4

/** Fenced by the lock token: a runner whose lock was taken over cannot write a stale result. */
export async function finishStage(db: Db, lock: BuildRow, next: Stage, note: { stage: string; ms: number; note?: string }): Promise<boolean> {
  const status: BuildStatus = next === 'done' ? 'done' : 'waiting'
  const rows = await db.query(
    `UPDATE builds SET stage = $2, status = $3, locked_at = NULL, error = NULL, updated_at = now(),
       log = log || $4::jsonb
     WHERE id = $1 AND stage = $5 AND lock_token = $6 RETURNING id`,
    [lock.id, next, status, [{ ...note, at: new Date().toISOString() }], lock.stage, lock.lock_token],
  )
  return rows.length > 0
}

export async function failStage(db: Db, lock: BuildRow, error: string, retryable: boolean): Promise<boolean> {
  const rows = await db.query(`UPDATE builds SET status = 'failed', locked_at = NULL, error = $2, retryable = $3, updated_at = now() WHERE id = $1 AND stage = $4 AND lock_token = $5 RETURNING id`, [
    lock.id,
    error.slice(0, 1000),
    retryable,
    lock.stage,
    lock.lock_token,
  ])
  return rows.length > 0
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
