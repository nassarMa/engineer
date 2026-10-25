import { beforeAll, describe, expect, it } from 'vitest'
import { createMockProvider } from '@/lib/ai/mock'
import { assembleSite } from '@/lib/pipeline/assemble'
import { autofix, checkSite, hasCritical } from '@/lib/qa'
import type { ExtractedMenu, SiteConfig } from '@/lib/schemas'

const ai = createMockProvider()
let extracted: ExtractedMenu
let config: SiteConfig

const fakeUpload = (id: string, w: number, h: number) => ({ id, kind: 'photo' as const, mime: 'image/webp', bytes: 1, width: w, height: h, storage_key: `${id}.webp`, url: `http://x/${id}.webp` })

beforeAll(async () => {
  const ctx = { name: 'Olive & Fire', description: 'Family grill.' }
  extracted = await ai.extractMenu([], ctx)
  const brand = await ai.brand({ ...ctx, menu: extracted, hasLogo: false, websiteLang: 'he', photoCount: 2 })
  const photos = [fakeUpload('p1', 1600, 1000), fakeUpload('p2', 900, 1300), fakeUpload('p3', 1200, 1200)]
  const design = await ai.design({ name: ctx.name, brand, menu: extracted, photos: photos.map((p) => ({ id: p.id, bytes: new Uint8Array(), mime: 'image/webp', width: p.width, height: p.height })), hasAbout: true, websiteLang: 'he' })
  const content = await ai.content({ ...ctx, menu: extracted, brand, websiteLang: 'he', address: 'Haifa', phone: '+972501234567' })
  config = assembleSite({ lang: 'he', name: ctx.name, phone: '+972 50 123 4567', address: 'Haifa', logo: null, menuUploads: [fakeUpload('m1', 900, 1200)], photoUploads: photos, extracted, brand, design, content })
})

describe('quality gate', () => {
  it('passes a well-formed site with Hebrew RTL and verbatim prices', () => {
    const issues = checkSite(config, extracted)
    expect(hasCritical(issues)).toBe(false)
    expect(config.dir).toBe('rtl')
    const prices = config.menu.categories.flatMap((c) => c.items.map((i) => i.price))
    expect(prices).toEqual(extracted.categories.flatMap((c) => c.items.map((i) => i.price)))
    expect(config.menu.categories[0].name).toBe('ראשונות')
  })

  it('catches a tampered price and repairs it from the extraction', () => {
    const bad = structuredClone(config)
    bad.menu.categories[0].items[0].price = '2500'
    const issues = checkSite(bad, extracted)
    expect(issues.some((i) => i.code === 'price-mismatch')).toBe(true)
    const fixed = autofix(bad, extracted, issues)
    expect(fixed.menu.categories[0].items[0].price).toBe('25')
    expect(hasCritical(checkSite(fixed, extracted))).toBe(false)
  })

  it('never shows a low-confidence price as fact', () => {
    const shaky = structuredClone(extracted)
    shaky.categories[0].items[0].priceConfidence = 'low'
    const rebuilt = autofix(config, shaky, checkSite(config, shaky))
    expect(rebuilt.menu.categories[0].items[0].price).toBeNull()
    expect(hasCritical(checkSite(rebuilt, shaky))).toBe(false)
  })

  it('drops empty sections and missing photos', () => {
    const bad = structuredClone(config)
    bad.design.heroPhotoId = 'does-not-exist'
    bad.design.galleryPhotoIds = ['p2', 'nope']
    bad.content.about = null
    const issues = checkSite(bad, extracted)
    expect(issues.map((i) => i.code)).toEqual(expect.arrayContaining(['hero-photo-missing', 'gallery-photo-missing', 'about-empty']))
    const fixed = autofix(bad, extracted, issues)
    expect(fixed.design.heroLayout).toBe('typographic')
    expect(fixed.design.sections).not.toContain('about')
    expect(fixed.design.sections).not.toContain('gallery')
    expect(checkSite(fixed, extracted)).toEqual([])
  })

  it('flags a broken phone link and bad direction', () => {
    const bad = structuredClone(config)
    bad.restaurant.telHref = 'tel:'
    bad.dir = 'ltr'
    const codes = checkSite(bad, extracted).map((i) => i.code)
    expect(codes).toContain('tel')
    expect(codes).toContain('dir')
  })

  it('truncates over-long copy', () => {
    const bad = structuredClone(config)
    bad.content.headline = 'x'.repeat(200)
    bad.content.seoTitle = 'y'.repeat(120)
    const fixed = autofix(bad, extracted, checkSite(bad, extracted))
    expect(fixed.content.headline.length).toBeLessThanOrEqual(80)
    expect(fixed.content.seoTitle.length).toBeLessThanOrEqual(70)
  })
})
