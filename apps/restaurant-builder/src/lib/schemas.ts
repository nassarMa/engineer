import { z } from 'zod'

/**
 * Every piece of AI output is configuration validated here. The renderer only
 * understands these shapes, so a model can never emit executable code or an
 * unexpected layout.
 *
 * Output schemas (used with structured outputs) avoid defaults/optionals:
 * fields are required or nullable so the model must decide explicitly.
 */

export const localeSchema = z.enum(['ar', 'en', 'he'])
export type Locale = z.infer<typeof localeSchema>

// ---------------------------------------------------------------- input

export const logoModeSchema = z.enum(['none', 'upload', 'in-menu'])

/** Owner-typed text: never markup. */
const plain = (min: number, max: number) => z.string().trim().min(min).max(max).refine((v) => !/[<>]/.test(v), { message: 'must not contain < or >' })

export const restaurantInputSchema = z.object({
  locale: localeSchema,
  name: plain(1, 80),
  phone: plain(5, 30),
  address: plain(3, 200),
  description: plain(0, 600).default(''),
  websiteLang: localeSchema,
  logoMode: logoModeSchema.default('none'),
  menuUploadIds: z.array(z.string().min(1)).min(1).max(8),
  logoUploadId: z.string().min(1).nullable().default(null),
  photoUploadIds: z.array(z.string().min(1)).max(12).default([]),
})
export type RestaurantInput = z.infer<typeof restaurantInputSchema>

export const restaurantUpdateSchema = z.object({
  name: plain(1, 80),
  phone: plain(5, 30),
  address: plain(3, 200),
  description: plain(0, 600),
})
export type RestaurantUpdate = z.infer<typeof restaurantUpdateSchema>

// ---------------------------------------------------------------- stage 1: menu intelligence

export const confidenceSchema = z.enum(['high', 'low'])

export const extractedItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  /** Price exactly as printed (digits, decimals, currency sign). Null when absent. */
  price: z.string().nullable(),
  priceConfidence: confidenceSchema,
  nameConfidence: confidenceSchema,
})

export const extractedCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  items: z.array(extractedItemSchema),
})

export const bboxSchema = z.object({
  page: z.number(),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
})

export const extractedMenuSchema = z.object({
  sourceLanguage: z.enum(['ar', 'en', 'he', 'mixed', 'unknown']),
  /** Currency as it appears on the menu (e.g. "₪", "ILS", "$"), or null. */
  currency: z.string().nullable(),
  categories: z.array(extractedCategorySchema),
  branding: z.object({
    detectedName: z.string().nullable(),
    logoDetected: z.boolean(),
    logoDescription: z.string().nullable(),
    /** Up to 4 dominant brand colours seen on the menu as hex strings. */
    colorsSeen: z.array(z.string()),
    /** Where the logo is, as fractions of the page (0..1). Null if none. */
    logoBox: bboxSchema.nullable(),
  }),
  readability: z.enum(['good', 'partial', 'unreadable']),
  /** Anything uncertain or unreadable, for the record. */
  notes: z.array(z.string()),
})
export type ExtractedMenu = z.infer<typeof extractedMenuSchema>
export type ExtractedItem = z.infer<typeof extractedItemSchema>

// ---------------------------------------------------------------- stage 2: brand identity

export const THEME_PRESETS = ['warm-rustic', 'modern-minimal', 'elegant-dark', 'fresh-cafe', 'street-bold', 'coastal-light'] as const
export const FONT_PAIRS = ['serif-classic', 'modern-sans', 'rounded-friendly', 'bold-display'] as const
export const PERSONALITIES = ['warm', 'modern', 'elegant', 'playful', 'rustic', 'fresh', 'bold'] as const

export const brandSchema = z.object({
  cuisine: z.string(),
  personality: z.enum(PERSONALITIES),
  preset: z.enum(THEME_PRESETS),
  fontPair: z.enum(FONT_PAIRS),
  /** Accent colour as #rrggbb. */
  accent: z.string(),
  /** One or two sentences explaining the choices, for the record. */
  rationale: z.string(),
})
export type Brand = z.infer<typeof brandSchema>

// ---------------------------------------------------------------- stage 3: design director

export const SECTIONS = ['hero', 'about', 'menu', 'gallery', 'contact'] as const
export type SectionId = (typeof SECTIONS)[number]

export const designSchema = z.object({
  heroLayout: z.enum(['photo-full', 'photo-split', 'typographic']),
  menuLayout: z.enum(['cards', 'list', 'columns']),
  /** Section order; may omit sections that have nothing to show. */
  sections: z.array(z.enum(SECTIONS)),
  /** Upload id of the photo to use in the hero, or null. */
  heroPhotoId: z.string().nullable(),
  /** Upload ids to show in the gallery, in order. */
  galleryPhotoIds: z.array(z.string()),
  spacing: z.enum(['comfortable', 'compact']),
  rationale: z.string(),
})
export type Design = z.infer<typeof designSchema>

// ---------------------------------------------------------------- stage 4: content & localization

export const contentSchema = z.object({
  /** Restaurant name as it should appear on the site (may keep original script). */
  displayName: z.string(),
  headline: z.string(),
  subheadline: z.string(),
  about: z.string().nullable(),
  ctaCall: z.string(),
  ctaDirections: z.string(),
  ctaMenu: z.string(),
  menuTitle: z.string(),
  galleryTitle: z.string(),
  contactTitle: z.string(),
  aboutTitle: z.string(),
  addressLabel: z.string(),
  phoneLabel: z.string(),
  seoTitle: z.string(),
  seoDescription: z.string(),
  /** Translated categories/items. Ids must match the extracted menu; prices are not here on purpose. */
  categories: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      items: z.array(z.object({ id: z.string(), name: z.string(), description: z.string().nullable() })),
    }),
  ),
})
export type Content = z.infer<typeof contentSchema>

// ---------------------------------------------------------------- final site config

export const photoSchema = z.object({ id: z.string(), url: z.string(), width: z.number(), height: z.number(), alt: z.string() })
export type Photo = z.infer<typeof photoSchema>

export const siteConfigSchema = z.object({
  version: z.literal(1),
  lang: localeSchema,
  dir: z.enum(['rtl', 'ltr']),
  restaurant: z.object({
    name: z.string(),
    phone: z.string(),
    telHref: z.string(),
    address: z.string(),
    mapsUrl: z.string(),
    logo: photoSchema.nullable(),
  }),
  brand: brandSchema,
  design: designSchema,
  content: contentSchema,
  /** Menu as rendered: translated names with verbatim prices merged in by code. */
  menu: z.object({
    mode: z.enum(['structured', 'images']),
    currency: z.string().nullable(),
    categories: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        items: z.array(z.object({ id: z.string(), name: z.string(), description: z.string().nullable(), price: z.string().nullable() })),
      }),
    ),
    images: z.array(photoSchema),
  }),
  photos: z.array(photoSchema),
  generatedAt: z.string(),
})
export type SiteConfig = z.infer<typeof siteConfigSchema>

// ---------------------------------------------------------------- build state

export const STAGES = ['extract', 'brand', 'design', 'qa', 'publish', 'done'] as const
export type Stage = (typeof STAGES)[number]
export const BUILD_STATUSES = ['waiting', 'running', 'failed', 'done'] as const
export type BuildStatus = (typeof BUILD_STATUSES)[number]

export function nextStage(stage: Stage): Stage {
  const i = STAGES.indexOf(stage)
  return STAGES[Math.min(i + 1, STAGES.length - 1)]
}
