import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getRestaurantBySlug, updateRestaurant, verifyOwnerKey } from '@/lib/db/repo'
import { checkSite, hasCritical } from '@/lib/qa'
import { jsonError } from '@/lib/request'
import { restaurantUpdateSchema, type SiteConfig } from '@/lib/schemas'
import { mapsUrl, telHref } from '@/lib/text'

export const dynamic = 'force-dynamic'

function ownerKeyFrom(req: Request): string | null {
  return req.headers.get('x-owner-key')
}

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const db = await getDb()
  const r = await getRestaurantBySlug(db, slug)
  if (!r) return jsonError(404, 'not_found', 'Restaurant not found.')
  if (!verifyOwnerKey(r, ownerKeyFrom(req))) return jsonError(403, 'forbidden', 'Wrong edit key.')
  return NextResponse.json({ slug: r.slug, name: r.name, phone: r.phone, address: r.address, description: r.description, websiteLang: r.website_lang, publishedUrl: r.published_url, status: r.status })
}

/** Owner edits the basics; the site config is patched and re-checked without calling the AI. */
export async function PATCH(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const db = await getDb()
  const r = await getRestaurantBySlug(db, slug)
  if (!r) return jsonError(404, 'not_found', 'Restaurant not found.')
  if (!verifyOwnerKey(r, ownerKeyFrom(req))) return jsonError(403, 'forbidden', 'Wrong edit key.')
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError(400, 'bad_json', 'Body must be JSON.')
  }
  const parsed = restaurantUpdateSchema.safeParse(body)
  if (!parsed.success) return jsonError(400, 'invalid', 'Some fields are invalid.', { issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) })
  const u = parsed.data
  const tel = telHref(u.phone)
  if (!tel) return jsonError(400, 'invalid', 'Phone number is not valid.', { issues: [{ path: 'phone', message: 'invalid' }] })

  let site: SiteConfig | null = r.site_config
  if (site && r.extracted_menu) {
    site = structuredClone(site)
    const nameChanged = u.name !== r.name
    site.restaurant = { ...site.restaurant, name: u.name, phone: u.phone, telHref: tel, address: u.address, mapsUrl: mapsUrl(u.address) }
    if (nameChanged) {
      const old = site.content.displayName
      site.content.displayName = u.name
      site.content.seoTitle = site.content.seoTitle.includes(old) ? site.content.seoTitle.replace(old, u.name).slice(0, 70) : site.content.seoTitle
    }
    if (u.description !== r.description) {
      // The owner's own words replace the AI text; an empty description removes the section.
      site.content.about = u.description.trim() || null
      site.design.sections = site.content.about ? (site.design.sections.includes('about') ? site.design.sections : insertAbout(site.design.sections)) : site.design.sections.filter((s) => s !== 'about')
    }
    const issues = checkSite(site, r.extracted_menu)
    if (hasCritical(issues)) return jsonError(400, 'invalid', issues.filter((i) => i.severity === 'critical').map((i) => i.message).join('; '))
  }
  await updateRestaurant(db, r.id, { name: u.name, phone: u.phone, address: u.address, description: u.description, ...(site ? { site_config: site } : {}) })
  return NextResponse.json({ ok: true })
}

function insertAbout(sections: SiteConfig['design']['sections']): SiteConfig['design']['sections'] {
  const out = [...sections]
  const i = out.indexOf('menu')
  out.splice(i < 0 ? out.length : i, 0, 'about')
  return out
}
