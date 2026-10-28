import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Site } from '@/components/site/Site'
import { openDatabaseUrl, openTestDb, setDb, type Db } from '@/lib/db'
import { createRestaurant, insertUpload, type UploadRow } from '@/lib/db/repo'
import { DICTIONARIES } from '@/lib/i18n'
import { getRestaurantBySlug } from '@/lib/db/repo'
import type { RestaurantInput } from '@/lib/schemas'
import { getStorage } from '@/lib/storage'
import { processUpload, type UploadKind } from '@/lib/uploads'

export const fixture = (n: string) => new Uint8Array(fs.readFileSync(path.join(__dirname, '../fixtures', n)))

export async function setupEnv(): Promise<Db> {
  process.env.AI_PROVIDER = 'mock'
  process.env.APP_URL = 'http://test.local'
  delete process.env.PLATFORM_DOMAIN
  delete process.env.BLOB_READ_WRITE_TOKEN
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-test-'))
  // TEST_DATABASE_URL runs the suite against a real Postgres (the production driver); default is embedded PGlite.
  const db = process.env.TEST_DATABASE_URL ? await openDatabaseUrl(process.env.TEST_DATABASE_URL) : await openTestDb()
  setDb(db)
  return db
}

export async function upload(db: Db, name: string, kind: UploadKind): Promise<UploadRow> {
  const p = await processUpload(fixture(name), kind)
  const { url } = await getStorage().put(p.key, p.bytes, p.mime)
  return insertUpload(db, { kind, mime: p.mime, bytes: p.bytes.length, width: p.width, height: p.height, storage_key: p.key, url, ip: null })
}

export async function start(db: Db, overrides: Partial<RestaurantInput> & { photos?: string[]; menus?: string[] } = {}) {
  const menus = await Promise.all((overrides.menus ?? ['menu.jpg']).map((m) => upload(db, m, 'menu')))
  const photos = await Promise.all((overrides.photos ?? []).map((p) => upload(db, p, 'photo')))
  const input: RestaurantInput = {
    locale: 'en',
    name: 'Olive & Fire',
    phone: '+972 50 123 4567',
    address: 'Ha-Yarkon 10, Tel Aviv',
    description: 'A family restaurant serving traditional grilled food.',
    websiteLang: 'en',
    logoMode: 'none',
    menuUploadIds: menus.map((m) => m.id),
    logoUploadId: null,
    photoUploadIds: photos.map((p) => p.id),
    ...overrides,
  }
  return createRestaurant(db, input)
}

/**
 * Stand-in for the running server: when the pipeline fetches a site URL,
 * render the real Site component for that slug and return the HTML.
 */
export function installFetchStub(db: Db) {
  const original = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    const m = url.pathname.match(/^\/r\/([a-z0-9-]+)$/)
    if (!m) return new Response('not found', { status: 404 })
    const r = await getRestaurantBySlug(db, m[1])
    if (!r?.site_config) return new Response('not found', { status: 404 })
    if (r.status !== 'published' && url.searchParams.get('preview') !== r.preview_token) return new Response('not found', { status: 404 })
    const c = r.site_config
    const body = renderToStaticMarkup(createElement(Site, { config: c, fallbackNote: DICTIONARIES[c.lang].menuFallbackNote }))
    const html = `<!DOCTYPE html><html lang="${c.lang}" dir="${c.dir}"><head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><meta name="description" content="${c.content.seoDescription}"/></head><body>${body}</body></html>`
    return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } })
  }) as typeof fetch
  return () => {
    globalThis.fetch = original
  }
}
