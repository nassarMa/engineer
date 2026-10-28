import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { aiModel } from '../env'
import { brandSchema, contentSchema, designSchema, extractedMenuSchema, type Brand, type Content, type Design, type ExtractedMenu } from '../schemas'

const menuTranslationSchema = contentSchema.pick({ categories: true })
type SlimCategory = { id: string; name: string; items: { id: string; name: string; description: string | null }[] }

/** Split categories into groups of at most `size` items, keeping categories whole. */
export function chunkCategories(categories: SlimCategory[], size: number): SlimCategory[][] {
  const out: SlimCategory[][] = []
  let current: SlimCategory[] = []
  let count = 0
  for (const c of categories) {
    if (current.length && count + c.items.length > size) {
      out.push(current)
      current = []
      count = 0
    }
    current.push(c)
    count += c.items.length
  }
  if (current.length) out.push(current)
  return out
}
import { BRAND_SYSTEM, CONTENT_SYSTEM, DESIGN_SYSTEM, EXTRACT_SYSTEM, LANG_NAME, LOGO_SYSTEM } from './prompts'
import { AiError, type AiProvider, type BrandContext, type ContentContext, type DesignContext, type ExtractContext, type MenuFile } from './types'

/**
 * Claude provider. Each role is one structured-output request; the zod
 * schema is the contract and the SDK rejects anything that does not match.
 */
export function createAnthropicProvider(): AiProvider {
  // Must finish inside the advance route's 180 s budget, so a slow request fails cleanly instead of being killed mid-flight.
  const client = new Anthropic({ timeout: 150 * 1000, maxRetries: 1 })
  const model = aiModel()

  async function parse<S extends z.ZodType>(opts: {
    system: string
    content: Anthropic.ContentBlockParam[]
    schema: S
    effort: 'low' | 'medium' | 'high'
    maxTokens?: number
  }): Promise<z.infer<S>> {
    let res: Awaited<ReturnType<typeof client.messages.parse>>
    try {
      res = await client.messages.parse({
        model,
        max_tokens: opts.maxTokens ?? 16000,
        system: [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: opts.content }],
        output_config: { format: zodOutputFormat(opts.schema), effort: opts.effort },
      })
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) throw new AiError('AI credentials were rejected. Check ANTHROPIC_API_KEY.', false)
      if (e instanceof Anthropic.BadRequestError) throw new AiError(`AI request was rejected: ${e.message}`, false)
      if (e instanceof Anthropic.RateLimitError) throw new AiError('AI service is busy. Please try again in a minute.', true)
      if (e instanceof Anthropic.APIConnectionError) throw new AiError('Could not reach the AI service.', true)
      throw new AiError(`AI request failed: ${(e as Error).message}`, true)
    }
    if (res.stop_reason === 'refusal') throw new AiError('The AI declined to process this input.', false)
    if (res.stop_reason === 'max_tokens') throw new AiError('The AI response was cut off; the menu may be too long.', true)
    if (!res.parsed_output) throw new AiError('The AI returned an unreadable answer.', true)
    return res.parsed_output as z.infer<S>
  }

  function fileBlocks(files: MenuFile[]): Anthropic.ContentBlockParam[] {
    return files.map((f, i) => {
      const data = Buffer.from(f.bytes).toString('base64')
      if (f.mime === 'application/pdf') {
        return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data }, title: `menu-file-${i}` } as Anthropic.DocumentBlockParam
      }
      return { type: 'image', source: { type: 'base64', media_type: f.mime, data } } as Anthropic.ImageBlockParam
    })
  }

  return {
    name: 'anthropic',

    async extractMenu(files, ctx: ExtractContext): Promise<ExtractedMenu> {
      // One request per file, all at once: a 3-page menu takes as long as one page, and each request stays small.
      const pages = await Promise.all(
        files.map((file, page) => {
          const content: Anthropic.ContentBlockParam[] = [
            ...fileBlocks([file]),
            {
              type: 'text',
              text: `Restaurant name given by the owner: ${JSON.stringify(ctx.name)}\nOwner description: ${JSON.stringify(ctx.description || '')}\n\nThis is menu file ${page + 1} of ${files.length} (page index ${page}). Extract everything on it. Use category ids p${page + 1}-c1, p${page + 1}-c2, ... and item ids p${page + 1}-c1-1, p${page + 1}-c1-2, ...`,
            },
          ]
          return parse({ system: EXTRACT_SYSTEM, content, schema: extractedMenuSchema, effort: 'medium', maxTokens: 16000 })
        }),
      )
      return mergeExtractions(pages)
    },

    async brand(ctx: BrandContext): Promise<Brand> {
      const text = `Restaurant: ${JSON.stringify(ctx.name)}
Owner description: ${JSON.stringify(ctx.description || '(none)')}
Website language: ${LANG_NAME[ctx.websiteLang]}
Owner uploaded a logo: ${ctx.hasLogo}
Number of photos: ${ctx.photoCount}
Extracted menu (names and categories only):
${menuSummary(ctx.menu)}
Brand colours seen on the menu: ${ctx.menu.branding.colorsSeen.join(', ') || '(none)'}
Logo on menu: ${ctx.menu.branding.logoDescription ?? '(none)'}`
      return parse({ system: BRAND_SYSTEM, content: [{ type: 'text', text }], schema: brandSchema, effort: 'medium' })
    },

    async design(ctx: DesignContext): Promise<Design> {
      const content: Anthropic.ContentBlockParam[] = []
      for (const p of ctx.photos) {
        content.push({ type: 'text', text: `Photo id ${p.id} (${p.width}x${p.height}):` })
        content.push({ type: 'image', source: { type: 'base64', media_type: p.mime, data: Buffer.from(p.bytes).toString('base64') } })
      }
      const itemCount = ctx.menu.categories.reduce((n, c) => n + c.items.length, 0)
      const withDesc = ctx.menu.categories.reduce((n, c) => n + c.items.filter((i) => i.description).length, 0)
      content.push({
        type: 'text',
        text: `Restaurant: ${JSON.stringify(ctx.name)}
Brand: preset ${ctx.brand.preset}, personality ${ctx.brand.personality}, cuisine ${ctx.brand.cuisine}
Website language: ${LANG_NAME[ctx.websiteLang]}
hasAbout: ${ctx.hasAbout}
Menu: ${ctx.menu.categories.length} categories, ${itemCount} items, ${withDesc} with descriptions
Photos available: ${ctx.photos.length} (ids: ${ctx.photos.map((p) => p.id).join(', ') || 'none'})
Compose the page.`,
      })
      return parse({ system: DESIGN_SYSTEM, content, schema: designSchema, effort: 'medium' })
    },

    async content(ctx: ContentContext): Promise<Content> {
      const header = `Target website language: ${LANG_NAME[ctx.websiteLang]}
Restaurant name: ${JSON.stringify(ctx.name)}
Owner description: ${JSON.stringify(ctx.description || '')} ${ctx.description ? '' : '(none given: about must be null)'}
Cuisine: ${ctx.brand.cuisine}; personality: ${ctx.brand.personality}
Address (for context only, do not rewrite): ${JSON.stringify(ctx.address)}
Menu source language: ${ctx.menu.sourceLanguage}`
      const slim = ctx.menu.categories.map((c) => ({ id: c.id, name: c.name, items: c.items.map((i) => ({ id: i.id, name: i.name, description: i.description })) }))
      // Site copy and menu translation run side by side; the menu is translated in chunks so a long menu does not serialize into one slow request.
      const chunks = chunkCategories(slim, 18)
      const [meta, ...translated] = await Promise.all([
        parse({
          system: CONTENT_SYSTEM,
          content: [{ type: 'text', text: `${header}\nMenu overview (names only, for tone): ${slim.map((c) => c.name).join(', ')}\n\nWrite the site copy and labels. The categories field must be an empty array; the menu is translated separately.` }],
          schema: contentSchema,
          effort: 'medium',
          maxTokens: 4000,
        }),
        ...chunks.map((chunk) =>
          parse({
            system: CONTENT_SYSTEM,
            content: [{ type: 'text', text: `${header}\n\nTranslate exactly these categories and items into ${LANG_NAME[ctx.websiteLang]}, keeping every id:\n${JSON.stringify(chunk, null, 1)}` }],
            schema: menuTranslationSchema,
            effort: 'low',
            maxTokens: 16000,
          }),
        ),
      ])
      return { ...meta, categories: translated.flatMap((t) => t.categories) }
    },

    async judgeLogo(image): Promise<boolean> {
      const out = await parse({
        system: LOGO_SYSTEM,
        content: [
          { type: 'image', source: { type: 'base64', media_type: image.mime, data: Buffer.from(image.bytes).toString('base64') } },
          { type: 'text', text: 'Is this a clean, usable logo?' },
        ],
        schema: z.object({ usable: z.boolean(), reason: z.string() }),
        effort: 'low',
        maxTokens: 1000,
      })
      return out.usable
    },
  }
}

/** Combine per-file extractions into one menu; ids are already page-prefixed, duplicates get a suffix. */
export function mergeExtractions(pages: ExtractedMenu[]): ExtractedMenu {
  if (pages.length === 1) return pages[0]
  const seen = new Set<string>()
  const unique = (id: string) => {
    let out = id
    for (let n = 2; seen.has(out); n++) out = `${id}-${n}`
    seen.add(out)
    return out
  }
  const order = { good: 0, partial: 1, unreadable: 2 } as const
  const langs = new Set(pages.map((p) => p.sourceLanguage).filter((l) => l !== 'unknown'))
  const logoPage = pages.findIndex((p) => p.branding.logoDetected && p.branding.logoBox)
  return {
    sourceLanguage: langs.size === 1 ? [...langs][0] : langs.size > 1 ? 'mixed' : 'unknown',
    currency: pages.map((p) => p.currency).find((c) => c) ?? null,
    categories: pages.flatMap((p, i) =>
      p.categories.map((c) => {
        const cid = unique(c.id.startsWith(`p${i + 1}-`) ? c.id : `p${i + 1}-${c.id}`)
        return { ...c, id: cid, items: c.items.map((it) => ({ ...it, id: unique(it.id.startsWith(`p${i + 1}-`) ? it.id : `p${i + 1}-${it.id}`) })) }
      }),
    ),
    branding: {
      detectedName: pages.map((p) => p.branding.detectedName).find((n) => n) ?? null,
      logoDetected: logoPage >= 0,
      logoDescription: logoPage >= 0 ? pages[logoPage].branding.logoDescription : null,
      colorsSeen: [...new Set(pages.flatMap((p) => p.branding.colorsSeen))].slice(0, 4),
      logoBox: logoPage >= 0 ? { ...pages[logoPage].branding.logoBox!, page: logoPage } : null,
    },
    // The worst page decides: a partially readable page must still trigger the safe fallback rules.
    readability: pages.reduce<ExtractedMenu['readability']>((worst, p) => (order[p.readability] > order[worst] ? p.readability : worst), 'good'),
    notes: pages.flatMap((p, i) => p.notes.map((n) => `page ${i + 1}: ${n}`)),
  }
}

function menuSummary(menu: ExtractedMenu): string {
  return menu.categories.map((c) => `- ${c.name}: ${c.items.map((i) => i.name).join(', ')}`).join('\n') || '(no items extracted)'
}
