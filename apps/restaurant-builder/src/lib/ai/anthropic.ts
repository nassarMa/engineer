import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { aiModel } from '../env'
import { brandSchema, contentSchema, designSchema, extractedMenuSchema, type Brand, type Content, type Design, type ExtractedMenu } from '../schemas'
import { BRAND_SYSTEM, CONTENT_SYSTEM, DESIGN_SYSTEM, EXTRACT_SYSTEM, LANG_NAME, LOGO_SYSTEM } from './prompts'
import { AiError, type AiProvider, type BrandContext, type ContentContext, type DesignContext, type ExtractContext, type MenuFile } from './types'

/**
 * Claude provider. Each role is one structured-output request; the zod
 * schema is the contract and the SDK rejects anything that does not match.
 */
export function createAnthropicProvider(): AiProvider {
  const client = new Anthropic({ timeout: 10 * 60 * 1000, maxRetries: 2 })
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
      const content: Anthropic.ContentBlockParam[] = [
        ...fileBlocks(files),
        {
          type: 'text',
          text: `Restaurant name given by the owner: ${JSON.stringify(ctx.name)}\nOwner description: ${JSON.stringify(ctx.description || '')}\n\nThe files above are the menu pages in order (page index starts at 0). Extract the menu.`,
        },
      ]
      return parse({ system: EXTRACT_SYSTEM, content, schema: extractedMenuSchema, effort: 'high', maxTokens: 32000 })
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
      const text = `Target website language: ${LANG_NAME[ctx.websiteLang]}
Restaurant name: ${JSON.stringify(ctx.name)}
Owner description: ${JSON.stringify(ctx.description || '')} ${ctx.description ? '' : '(none given: about must be null)'}
Cuisine: ${ctx.brand.cuisine}; personality: ${ctx.brand.personality}
Address (for context only, do not rewrite): ${JSON.stringify(ctx.address)}
Menu source language: ${ctx.menu.sourceLanguage}
Extracted menu (ids, names, descriptions; prices withheld on purpose):
${JSON.stringify(ctx.menu.categories.map((c) => ({ id: c.id, name: c.name, items: c.items.map((i) => ({ id: i.id, name: i.name, description: i.description })) })), null, 1)}`
      return parse({ system: CONTENT_SYSTEM, content: [{ type: 'text', text }], schema: contentSchema, effort: 'medium', maxTokens: 32000 })
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

function menuSummary(menu: ExtractedMenu): string {
  return menu.categories.map((c) => `- ${c.name}: ${c.items.map((i) => i.name).join(', ')}`).join('\n') || '(no items extracted)'
}
