import { contrast } from './color'
import { buildPalette, PRESETS } from './render/themes'
import { siteConfigSchema, type ExtractedMenu, type SiteConfig } from './schemas'
import { dirOf } from './text'

/**
 * Deterministic quality gate. Everything here is a programmatic check on the
 * site configuration; the render check (does the page actually serve?) lives
 * in the pipeline because it needs the network.
 */

export type Issue = { severity: 'critical' | 'warning'; code: string; message: string }

export const LIMITS = { headline: 80, subheadline: 160, seoTitle: 70, seoDescription: 170, about: 700 }

export function checkSite(config: SiteConfig, extracted: ExtractedMenu): Issue[] {
  const issues: Issue[] = []
  const parsed = siteConfigSchema.safeParse(config)
  if (!parsed.success) {
    issues.push({ severity: 'critical', code: 'schema', message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') })
    return issues
  }

  // Direction and language agree.
  if (config.dir !== dirOf(config.lang)) issues.push({ severity: 'critical', code: 'dir', message: `dir ${config.dir} does not match lang ${config.lang}` })

  // Contact links are functional.
  if (!/^tel:\+?\d{7,15}$/.test(config.restaurant.telHref)) issues.push({ severity: 'critical', code: 'tel', message: 'phone link is not a valid tel: href' })
  if (!config.restaurant.mapsUrl.startsWith('https://www.google.com/maps/')) issues.push({ severity: 'critical', code: 'maps', message: 'directions link is not a maps URL' })

  // Prices: structured menu must mirror the extraction exactly.
  if (config.menu.mode === 'structured') {
    // Items whose name could not be read are deliberately left off the site; everything else must be present.
    const extractedById = new Map<string, { price: string | null; confidence: 'high' | 'low' }>()
    for (const c of extracted.categories) for (const it of c.items) if (it.nameConfidence === 'high') extractedById.set(it.id, { price: it.price, confidence: it.priceConfidence })
    const seen = new Set<string>()
    let total = 0
    for (const c of config.menu.categories) {
      for (const it of c.items) {
        total++
        seen.add(it.id)
        const src = extractedById.get(it.id)
        if (!src) {
          issues.push({ severity: 'critical', code: 'price-unknown-item', message: `item ${it.id} is not in the extracted menu` })
          continue
        }
        const expected = src.confidence === 'high' ? src.price : null
        if (it.price !== expected) issues.push({ severity: 'critical', code: 'price-mismatch', message: `item ${it.id}: price ${JSON.stringify(it.price)} differs from extracted ${JSON.stringify(expected)}` })
        if (!it.name.trim()) issues.push({ severity: 'critical', code: 'empty-name', message: `item ${it.id} has an empty name` })
      }
      if (!c.name.trim()) issues.push({ severity: 'critical', code: 'empty-category', message: `category ${c.id} has an empty name` })
      if (c.items.length === 0) issues.push({ severity: 'warning', code: 'empty-category-items', message: `category ${c.id} has no items` })
    }
    for (const id of extractedById.keys()) if (!seen.has(id)) issues.push({ severity: 'critical', code: 'missing-item', message: `extracted item ${id} is missing from the site` })
    if (total === 0) issues.push({ severity: 'critical', code: 'empty-menu', message: 'menu has no items' })
    // Price strings must not leak into copy.
    const prices = [...extractedById.values()].map((v) => v.price).filter((p): p is string => Boolean(p && p.length >= 2))
    const copy = [config.content.headline, config.content.subheadline, config.content.about ?? ''].join(' ')
    for (const p of prices) if (copy.includes(p) && /\d/.test(p) && p.length >= 3) issues.push({ severity: 'warning', code: 'price-in-copy', message: `copy contains the price "${p}"` })
  } else if (config.menu.images.length === 0) {
    issues.push({ severity: 'critical', code: 'no-menu-images', message: 'image menu has no images' })
  }

  // Readability: palette contrast.
  const pal = buildPalette(config.brand)
  if (contrast(pal.text, pal.bg) < 4.5) issues.push({ severity: 'critical', code: 'contrast-text', message: 'text on background below 4.5:1' })
  if (contrast(pal.onPrimary, pal.primary) < 4.5) issues.push({ severity: 'critical', code: 'contrast-button', message: 'button label below 4.5:1' })
  if (contrast(pal.muted, pal.bg) < 4.5) issues.push({ severity: 'warning', code: 'contrast-muted', message: 'muted text below 4.5:1' })

  // Sections must have content; media must exist.
  const photoIds = new Set(config.photos.map((p) => p.id))
  const d = config.design
  if (!d.sections.includes('hero') || !d.sections.includes('menu') || !d.sections.includes('contact')) issues.push({ severity: 'critical', code: 'sections-required', message: 'hero, menu and contact are required' })
  if (new Set(d.sections).size !== d.sections.length) issues.push({ severity: 'critical', code: 'sections-duplicate', message: 'duplicate section' })
  if (d.sections.includes('about') && !config.content.about?.trim()) issues.push({ severity: 'warning', code: 'about-empty', message: 'about section without text' })
  if (d.heroPhotoId && !photoIds.has(d.heroPhotoId)) issues.push({ severity: 'warning', code: 'hero-photo-missing', message: 'hero photo does not exist' })
  if (d.heroLayout !== 'typographic' && !d.heroPhotoId) issues.push({ severity: 'warning', code: 'hero-no-photo', message: `${d.heroLayout} hero without a photo` })
  const gallery = d.galleryPhotoIds.filter((id) => photoIds.has(id))
  if (gallery.length !== d.galleryPhotoIds.length) issues.push({ severity: 'warning', code: 'gallery-photo-missing', message: 'gallery references a missing photo' })
  if (d.sections.includes('gallery') && gallery.length < 2) issues.push({ severity: 'warning', code: 'gallery-thin', message: 'gallery with fewer than 2 photos' })
  if (d.heroPhotoId && d.galleryPhotoIds.includes(d.heroPhotoId)) issues.push({ severity: 'warning', code: 'hero-in-gallery', message: 'hero photo repeated in gallery' })

  // Copy lengths and required text.
  const c = config.content
  if (!c.displayName.trim()) issues.push({ severity: 'critical', code: 'no-name', message: 'display name is empty' })
  if (!c.headline.trim()) issues.push({ severity: 'critical', code: 'no-headline', message: 'headline is empty' })
  if (c.headline.length > LIMITS.headline) issues.push({ severity: 'warning', code: 'headline-long', message: 'headline too long' })
  if (c.subheadline.length > LIMITS.subheadline) issues.push({ severity: 'warning', code: 'subheadline-long', message: 'subheadline too long' })
  if (c.seoTitle.length > LIMITS.seoTitle) issues.push({ severity: 'warning', code: 'seo-title-long', message: 'seo title too long' })
  if (c.seoDescription.length > LIMITS.seoDescription) issues.push({ severity: 'warning', code: 'seo-description-long', message: 'seo description too long' })
  if ((c.about?.length ?? 0) > LIMITS.about) issues.push({ severity: 'warning', code: 'about-long', message: 'about too long' })
  for (const key of ['ctaCall', 'ctaDirections', 'menuTitle', 'contactTitle'] as const) if (!c[key].trim()) issues.push({ severity: 'critical', code: `label-${key}`, message: `${key} is empty` })

  // Fonts cover the script of the site language (the table guarantees it; keep the check honest).
  if (!PRESETS[config.brand.preset]) issues.push({ severity: 'critical', code: 'preset', message: 'unknown preset' })

  return issues
}

export function hasCritical(issues: Issue[]): boolean {
  return issues.some((i) => i.severity === 'critical')
}

const cut = (s: string, n: number) => (s.length <= n ? s : Array.from(s).slice(0, n - 1).join('').trimEnd() + '…')

/** Repair what can be repaired deterministically; the caller re-checks afterwards. */
export function autofix(config: SiteConfig, extracted: ExtractedMenu, issues: Issue[]): SiteConfig {
  const codes = new Set(issues.map((i) => i.code))
  const next: SiteConfig = structuredClone(config)
  const photoIds = new Set(next.photos.map((p) => p.id))

  if (codes.has('price-mismatch') || codes.has('price-unknown-item') || codes.has('missing-item') || codes.has('empty-name') || codes.has('empty-category')) {
    // Rebuild the structured menu from the extraction instead of trusting the content stage.
    next.menu.categories = rebuildMenuFromExtraction(next, extracted)
    const stillBroken = next.menu.categories.length === 0
    if (stillBroken) next.menu.mode = next.menu.images.length > 0 ? 'images' : 'structured'
  }
  if (codes.has('empty-menu')) next.menu.mode = next.menu.images.length > 0 ? 'images' : next.menu.mode
  if (codes.has('empty-category-items')) next.menu.categories = next.menu.categories.filter((c) => c.items.length > 0)

  if (codes.has('contrast-text') || codes.has('contrast-button')) next.brand.accent = PRESETS[next.brand.preset].defaultAccent

  if (codes.has('hero-photo-missing') || (next.design.heroPhotoId && !photoIds.has(next.design.heroPhotoId))) next.design.heroPhotoId = null
  if (codes.has('gallery-photo-missing') || codes.has('hero-in-gallery')) next.design.galleryPhotoIds = next.design.galleryPhotoIds.filter((id) => photoIds.has(id) && id !== next.design.heroPhotoId)
  if (!next.design.heroPhotoId) next.design.heroLayout = 'typographic'
  if (codes.has('hero-no-photo')) next.design.heroLayout = 'typographic'
  if (next.design.galleryPhotoIds.length < 2) next.design.sections = next.design.sections.filter((s) => s !== 'gallery')
  if (!next.content.about?.trim()) next.design.sections = next.design.sections.filter((s) => s !== 'about')
  next.design.sections = [...new Set(next.design.sections)]
  for (const s of ['hero', 'menu', 'contact'] as const) if (!next.design.sections.includes(s)) next.design.sections.push(s)
  if (codes.has('sections-required') || codes.has('sections-duplicate')) {
    const order: SiteConfig['design']['sections'] = ['hero', 'about', 'menu', 'gallery', 'contact']
    next.design.sections = order.filter((s) => next.design.sections.includes(s))
  }

  next.content.headline = cut(next.content.headline, LIMITS.headline)
  next.content.subheadline = cut(next.content.subheadline, LIMITS.subheadline)
  next.content.seoTitle = cut(next.content.seoTitle, LIMITS.seoTitle)
  next.content.seoDescription = cut(next.content.seoDescription, LIMITS.seoDescription)
  if (next.content.about) next.content.about = cut(next.content.about, LIMITS.about)
  if (!next.content.displayName.trim()) next.content.displayName = next.restaurant.name
  if (!next.content.headline.trim()) next.content.headline = next.content.displayName
  return next
}

/** Structured menu with names from the content stage where ids match, prices always from the extraction. */
export function rebuildMenuFromExtraction(config: SiteConfig, extracted: ExtractedMenu): SiteConfig['menu']['categories'] {
  const names = new Map<string, { name: string; description: string | null }>()
  for (const c of config.content.categories) {
    names.set(c.id, { name: c.name, description: null })
    for (const it of c.items) names.set(it.id, { name: it.name, description: it.description })
  }
  return extracted.categories
    .map((c) => ({
      id: c.id,
      name: names.get(c.id)?.name?.trim() || c.name,
      items: c.items
        .filter((it) => it.nameConfidence === 'high')
        .map((it) => ({
          id: it.id,
          name: names.get(it.id)?.name?.trim() || it.name,
          description: it.description === null ? null : (names.get(it.id)?.description ?? it.description),
          price: it.priceConfidence === 'high' ? it.price : null,
        })),
    }))
    .filter((c) => c.items.length > 0)
}
