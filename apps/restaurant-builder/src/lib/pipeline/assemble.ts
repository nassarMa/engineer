import type { UploadRow } from '../db/repo'
import type { Brand, Content, Design, ExtractedMenu, Locale, Photo, SiteConfig } from '../schemas'
import { dirOf, mapsUrl, telHref } from '../text'
import { rebuildMenuFromExtraction } from '../qa'

export type AssembleInput = {
  lang: Locale
  name: string
  phone: string
  address: string
  logo: UploadRow | null
  menuUploads: UploadRow[]
  photoUploads: UploadRow[]
  extracted: ExtractedMenu
  brand: Brand
  design: Design
  content: Content
}

export function toPhoto(u: UploadRow, alt: string): Photo {
  return { id: u.id, url: u.url, width: u.width ?? 0, height: u.height ?? 0, alt }
}

/** Decide whether the extraction is trustworthy enough to show as a structured menu. */
export function menuModeFor(extracted: ExtractedMenu): 'structured' | 'images' {
  const items = extracted.categories.flatMap((c) => c.items)
  if (extracted.readability === 'unreadable' || items.length === 0) return 'images'
  const low = items.filter((i) => i.nameConfidence === 'low' || i.priceConfidence === 'low').length
  return low / items.length > 0.3 ? 'images' : 'structured'
}

export function assembleSite(input: AssembleInput): SiteConfig {
  const tel = telHref(input.phone) ?? 'tel:'
  const photos = input.photoUploads.map((u) => toPhoto(u, input.name))
  const base: SiteConfig = {
    version: 1,
    lang: input.lang,
    dir: dirOf(input.lang),
    restaurant: {
      name: input.name,
      phone: input.phone,
      telHref: tel,
      address: input.address,
      mapsUrl: mapsUrl(input.address),
      logo: input.logo ? toPhoto(input.logo, `${input.name} logo`) : null,
    },
    brand: input.brand,
    design: input.design,
    content: input.content,
    menu: {
      mode: menuModeFor(input.extracted),
      currency: input.extracted.currency,
      categories: [],
      images: input.menuUploads.filter((u) => u.mime.startsWith('image/')).map((u) => toPhoto(u, `${input.name} menu`)),
    },
    photos,
    generatedAt: new Date().toISOString(),
  }
  base.menu.categories = rebuildMenuFromExtraction(base, input.extracted)
  if (base.menu.mode === 'images' && base.menu.images.length === 0) {
    // PDF-only menu that could not be read: structured is the only option; QA will decide.
    base.menu.mode = 'structured'
  }
  return base
}
