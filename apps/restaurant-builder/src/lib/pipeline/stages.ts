import { getAiProvider } from '../ai'
import type { MenuFile, PhotoRef } from '../ai/types'
import type { Db } from '../db'
import { getUploads, insertUpload, updateRestaurant, type RestaurantRow, type UploadRow } from '../db/repo'
import { appUrl, publicSiteUrl } from '../env'
import { autofix, checkSite, hasCritical, type Issue } from '../qa'
import { brandSchema, contentSchema, designSchema, extractedMenuSchema, type SiteConfig, type Stage } from '../schemas'
import { getStorage } from '../storage'
import { cropBox, thumbnail } from '../uploads'
import { assembleSite } from './assemble'

export class StageError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message)
  }
}

export type StageContext = { db: Db; restaurant: RestaurantRow }

async function loadMedia(ctx: StageContext) {
  const { db, restaurant } = ctx
  const menuUploads = await getUploads(db, restaurant.menu_upload_ids)
  const photoUploads = await getUploads(db, restaurant.photo_upload_ids)
  const logo = restaurant.logo_upload_id ? (await getUploads(db, [restaurant.logo_upload_id]))[0] ?? null : null
  if (menuUploads.length === 0) throw new StageError('The menu files could not be found.', false)
  return { menuUploads, photoUploads, logo }
}

async function readUpload(u: UploadRow): Promise<Uint8Array> {
  return getStorage().get(u.storage_key, u.url)
}

/** Stage 1: menu intelligence (+ logo detection on the menu). */
export async function runExtract(ctx: StageContext): Promise<string> {
  const { db, restaurant } = ctx
  const ai = getAiProvider()
  const { menuUploads } = await loadMedia(ctx)
  const files: MenuFile[] = []
  const pageBytes: (Uint8Array | null)[] = []
  for (const u of menuUploads) {
    const bytes = await readUpload(u)
    if (u.mime === 'application/pdf') {
      files.push({ bytes, mime: 'application/pdf' })
      pageBytes.push(null)
    } else {
      const small = await thumbnail(bytes, 1568)
      files.push({ bytes: small.bytes, mime: small.mime })
      pageBytes.push(bytes)
    }
  }
  const raw = await ai.extractMenu(files, { name: restaurant.name, description: restaurant.description })
  const extracted = extractedMenuSchema.parse(raw)
  // Ids must be unique; a model slip here would corrupt price matching later.
  const ids = new Set<string>()
  for (const c of extracted.categories) {
    if (ids.has(c.id)) throw new StageError(`Duplicate category id ${c.id} from extraction.`, true)
    ids.add(c.id)
    for (const it of c.items) {
      if (ids.has(it.id)) throw new StageError(`Duplicate item id ${it.id} from extraction.`, true)
      ids.add(it.id)
    }
  }

  let logoNote = ''
  if (restaurant.logo_mode === 'in-menu' && !restaurant.logo_upload_id && extracted.branding.logoDetected && extracted.branding.logoBox) {
    const box = extracted.branding.logoBox
    const source = pageBytes[box.page] ?? null
    if (source) {
      const crop = await cropBox(source, box)
      if (crop && (await ai.judgeLogo(crop))) {
        const key = `${crypto.randomUUID().replace(/-/g, '')}.webp`
        const { url } = await getStorage().put(key, crop.bytes, crop.mime)
        const row = await insertUpload(db, { kind: 'logo', mime: crop.mime, bytes: crop.bytes.length, width: crop.width, height: crop.height, storage_key: key, url, ip: null })
        await updateRestaurant(db, restaurant.id, { logo_upload_id: row.id })
        logoNote = 'logo extracted from menu'
      } else logoNote = 'logo on menu not clean enough; using typographic name'
    }
  }
  await updateRestaurant(db, restaurant.id, { extracted_menu: extracted })
  const items = extracted.categories.reduce((n, c) => n + c.items.length, 0)
  return `${extracted.categories.length} categories, ${items} items, readability ${extracted.readability}${logoNote ? '; ' + logoNote : ''}`
}

/** Stage 2: brand identity. */
export async function runBrand(ctx: StageContext): Promise<string> {
  const { db, restaurant } = ctx
  if (!restaurant.extracted_menu) throw new StageError('Menu extraction is missing.', false)
  const brand = brandSchema.parse(
    await getAiProvider().brand({
      name: restaurant.name,
      description: restaurant.description,
      menu: restaurant.extracted_menu,
      hasLogo: Boolean(restaurant.logo_upload_id),
      websiteLang: restaurant.website_lang,
      photoCount: restaurant.photo_upload_ids.length,
    }),
  )
  await updateRestaurant(db, restaurant.id, { brand })
  return `${brand.preset} / ${brand.fontPair} / ${brand.accent}`
}

/** Stage 3: design director (sees the photos). */
export async function runDesign(ctx: StageContext): Promise<string> {
  const { db, restaurant } = ctx
  if (!restaurant.extracted_menu || !restaurant.brand) throw new StageError('Earlier stages are missing.', false)
  const { photoUploads } = await loadMedia(ctx)
  const photos: PhotoRef[] = []
  for (const u of photoUploads) {
    const small = await thumbnail(await readUpload(u), 512)
    photos.push({ id: u.id, bytes: small.bytes, mime: small.mime, width: u.width ?? small.width, height: u.height ?? small.height })
  }
  const design = designSchema.parse(
    await getAiProvider().design({
      name: restaurant.name,
      brand: restaurant.brand,
      menu: restaurant.extracted_menu,
      photos,
      hasAbout: restaurant.description.trim().length > 0,
      websiteLang: restaurant.website_lang,
    }),
  )
  await updateRestaurant(db, restaurant.id, { design })
  return `${design.heroLayout} / ${design.menuLayout} / ${design.sections.join(',')}`
}

/** Stage 4: content and localization. */
export async function runContent(ctx: StageContext): Promise<string> {
  const { db, restaurant } = ctx
  if (!restaurant.extracted_menu || !restaurant.brand) throw new StageError('Earlier stages are missing.', false)
  const content = contentSchema.parse(
    await getAiProvider().content({
      name: restaurant.name,
      description: restaurant.description,
      menu: restaurant.extracted_menu,
      brand: restaurant.brand,
      websiteLang: restaurant.website_lang,
      address: restaurant.address,
      phone: restaurant.phone,
    }),
  )
  await updateRestaurant(db, restaurant.id, { content })
  return `headline "${content.headline}"`
}

export type QaReport = { attempts: { issues: Issue[] }[]; renderCheck: { ok: boolean; detail: string } | null; passed: boolean }

/** Stage 5: assemble the site and run the quality gate, fixing and retrying once. */
export async function runQa(ctx: StageContext): Promise<string> {
  const { db, restaurant } = ctx
  const { extracted_menu: extracted, brand, design, content } = restaurant
  if (!extracted || !brand || !design || !content) throw new StageError('Earlier stages are missing.', false)
  const { menuUploads, photoUploads, logo } = await loadMedia(ctx)
  let config = assembleSite({ lang: restaurant.website_lang, name: restaurant.name, phone: restaurant.phone, address: restaurant.address, logo, menuUploads, photoUploads, extracted, brand, design, content })

  const report: QaReport = { attempts: [], renderCheck: null, passed: false }
  let issues = checkSite(config, extracted)
  report.attempts.push({ issues })
  for (let i = 0; i < 2 && issues.length > 0; i++) {
    config = autofix(config, extracted, issues)
    issues = checkSite(config, extracted)
    report.attempts.push({ issues })
  }
  if (hasCritical(issues)) {
    await updateRestaurant(db, restaurant.id, { qa_report: report })
    throw new StageError(`Quality check failed: ${issues.filter((i) => i.severity === 'critical').map((i) => i.message).join('; ')}`, false)
  }
  await updateRestaurant(db, restaurant.id, { site_config: config })

  // Render check: the real page must serve with the right language and the restaurant name.
  const previewUrl = `${appUrl()}/r/${restaurant.slug}?preview=${encodeURIComponent(restaurant.preview_token)}`
  report.renderCheck = await renderCheck(previewUrl, config)
  await updateRestaurant(db, restaurant.id, { qa_report: report })
  if (!report.renderCheck.ok) throw new StageError(`The page did not render correctly: ${report.renderCheck.detail}`, true)
  report.passed = true
  await updateRestaurant(db, restaurant.id, { qa_report: report })
  const warnings = issues.length
  return `passed (${report.attempts.length} pass${report.attempts.length > 1 ? 'es' : ''}, ${warnings} warning${warnings === 1 ? '' : 's'} left), render ok`
}

async function renderCheck(url: string, config: SiteConfig): Promise<{ ok: boolean; detail: string }> {
  let html: string
  try {
    const res = await fetchWithTimeout(url, 20000)
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` }
    html = await res.text()
  } catch (e) {
    return { ok: false, detail: `fetch failed: ${(e as Error).message}` }
  }
  const problems: string[] = []
  if (!html.includes(`lang="${config.lang}"`)) problems.push('html lang missing')
  if (!html.includes(`dir="${config.dir}"`)) problems.push('html dir missing')
  if (!html.includes(escapeHtml(config.content.displayName))) problems.push('restaurant name missing')
  if (!html.includes(`href="${config.restaurant.telHref}"`)) problems.push('call link missing')
  if (!html.includes('href="https://www.google.com/maps/')) problems.push('directions link missing')
  if (!html.includes('<meta name="viewport"')) problems.push('viewport meta missing')
  if (!html.includes('<meta name="description"')) problems.push('meta description missing')
  if (config.menu.mode === 'structured') {
    for (const c of config.menu.categories) for (const it of c.items) if (it.price && !html.includes(escapeHtml(it.price))) problems.push(`price ${it.price} missing`)
  }
  return problems.length ? { ok: false, detail: problems.join(', ') } : { ok: true, detail: 'ok' }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), ms)
  try {
    return await fetch(url, { signal: ctl.signal, cache: 'no-store', redirect: 'follow' })
  } finally {
    clearTimeout(timer)
  }
}

/** Stage 6: publish and verify the public URL really serves. */
export async function runPublish(ctx: StageContext): Promise<string> {
  const { db, restaurant } = ctx
  if (!restaurant.site_config) throw new StageError('Site configuration is missing.', false)
  const url = publicSiteUrl(restaurant.slug)
  await updateRestaurant(db, restaurant.id, { status: 'published', published_url: url, published_at: new Date().toISOString() })
  let lastError = ''
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetchWithTimeout(url, 20000)
      if (res.ok) {
        const html = await res.text()
        if (html.includes(escapeHtml(restaurant.site_config.content.displayName))) {
          await updateRestaurant(db, restaurant.id, { verified_at: new Date().toISOString() })
          return url
        }
        lastError = 'page served but without the restaurant content'
      } else lastError = `HTTP ${res.status}`
    } catch (e) {
      lastError = (e as Error).message
    }
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
  }
  await updateRestaurant(db, restaurant.id, { status: 'failed' })
  throw new StageError(`The website was saved but is not reachable at ${url} (${lastError}). Check the domain configuration.`, true)
}

export const STAGE_RUNNERS: Record<Exclude<Stage, 'done'>, (ctx: StageContext) => Promise<string>> = {
  extract: runExtract,
  brand: runBrand,
  design: runDesign,
  content: runContent,
  qa: runQa,
  publish: runPublish,
}
