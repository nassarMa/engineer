import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '@/lib/db'
import { getRestaurantBySlug, verifyOwnerKey } from '@/lib/db/repo'
import { advanceBuild, runBuildToEnd } from '@/lib/pipeline/runner'
import { installFetchStub, setupEnv, start } from './helpers'

let db: Db
let restoreFetch: () => void

beforeAll(async () => {
  db = await setupEnv()
  restoreFetch = installFetchStub(db)
})
afterAll(async () => {
  restoreFetch()
  await db.close()
})

describe('end-to-end pipeline (mock AI, embedded Postgres, local storage)', () => {
  it('builds an English grill site with photos and verifies the public URL', async () => {
    const { build, restaurant, ownerKey } = await start(db, { photos: ['food-landscape.jpg', 'food-portrait.jpg', 'interior.png'] })
    expect(verifyOwnerKey(restaurant, ownerKey)).toBe(true)
    expect(verifyOwnerKey(restaurant, 'wrong')).toBe(false)
    const view = await runBuildToEnd(db, build.id)
    expect(view.error).toBeNull()
    expect(view.status).toBe('done')
    expect(view.publishedUrl).toBe(`http://test.local/r/${restaurant.slug}`)
    const r = (await getRestaurantBySlug(db, restaurant.slug))!
    expect(r.status).toBe('published')
    expect(r.verified_at).toBeTruthy()
    const cfg = r.site_config!
    expect(cfg.lang).toBe('en')
    expect(cfg.dir).toBe('ltr')
    expect(cfg.brand.preset).toBe('warm-rustic')
    expect(cfg.design.heroLayout).toBe('photo-full')
    expect(cfg.design.sections).toEqual(['hero', 'about', 'menu', 'gallery', 'contact'])
    expect(cfg.menu.mode).toBe('structured')
    expect(cfg.menu.categories.flatMap((c) => c.items.map((i) => i.price))).toEqual(['25', '28', '22', '68', '75', '120', '15', '8'])
    expect(view.log.map((l) => l.stage)).toEqual(['extract', 'brand', 'design', 'content', 'qa', 'publish'])
  })

  it('builds an Arabic café site (RTL) from a builder used in Hebrew', async () => {
    const { build, restaurant } = await start(db, { locale: 'he', name: 'Café Noir', description: '', websiteLang: 'ar' })
    const view = await runBuildToEnd(db, build.id)
    expect(view.status, view.error ?? '').toBe('done')
    const cfg = (await getRestaurantBySlug(db, restaurant.slug))!.site_config!
    expect(cfg.lang).toBe('ar')
    expect(cfg.dir).toBe('rtl')
    expect(cfg.brand.preset).toBe('fresh-cafe')
    expect(cfg.design.heroLayout).toBe('typographic')
    expect(cfg.design.sections).toEqual(['hero', 'menu', 'contact'])
    expect(cfg.content.about).toBeNull()
    expect(cfg.menu.categories[0].name).toBe('القهوة')
    expect(cfg.menu.categories[1].items[2].price).toBe('38.50')
  })

  it('builds a Hebrew seafood site and keeps a missing price missing', async () => {
    const { build, restaurant } = await start(db, { locale: 'ar', name: 'Sea Breeze Fish', websiteLang: 'he', photos: ['food-portrait.jpg'] })
    const view = await runBuildToEnd(db, build.id)
    expect(view.status, view.error ?? '').toBe('done')
    const cfg = (await getRestaurantBySlug(db, restaurant.slug))!.site_config!
    expect(cfg.lang).toBe('he')
    expect(cfg.brand.preset).toBe('coastal-light')
    expect(cfg.design.heroLayout).toBe('photo-split')
    const chefSalad = cfg.menu.categories[1].items[1]
    expect(chefSalad.name).toBe('סלט השף')
    expect(chefSalad.price).toBeNull()
  })

  it('falls back to the original menu images when the menu is unreadable', async () => {
    const { build, restaurant } = await start(db, { name: 'UNREADABLE Diner' })
    const view = await runBuildToEnd(db, build.id)
    expect(view.status, view.error ?? '').toBe('done')
    const cfg = (await getRestaurantBySlug(db, restaurant.slug))!.site_config!
    expect(cfg.menu.mode).toBe('images')
    expect(cfg.menu.images.length).toBe(1)
    expect(cfg.menu.categories).toEqual([])
  })

  it('refuses to publish when nothing accurate can be shown (unreadable PDF-only menu)', async () => {
    const { build } = await start(db, { name: 'UNREADABLE Pdf Place', menus: ['menu.pdf'] })
    const view = await runBuildToEnd(db, build.id)
    expect(view.status).toBe('failed')
    expect(view.stage).toBe('qa')
    expect(view.error).toMatch(/Quality check failed/)
  })

  it('is idempotent: concurrent advance calls run one stage, retries resume in place', async () => {
    const { build, restaurant } = await start(db, { name: 'Twin Grill' })
    const [a, b] = await Promise.all([advanceBuild(db, build.id), advanceBuild(db, build.id)])
    const stages = [a!.stage, b!.stage].sort()
    expect(stages).toContain('brand')
    const slugBefore = restaurant.slug
    const view = await runBuildToEnd(db, build.id)
    expect(view.status).toBe('done')
    // Retrying a finished build changes nothing and creates no second site.
    const again = await advanceBuild(db, build.id, { retry: true })
    expect(again!.status).toBe('done')
    expect(again!.slug).toBe(slugBefore)
  })

  it('reserves distinct slugs for restaurants with the same name', async () => {
    const name = `Same Name ${Date.now().toString(36)}`
    const base = name.toLowerCase().replace(/ /g, '-')
    const one = await start(db, { name })
    const two = await start(db, { name })
    expect(one.restaurant.slug).toBe(base)
    expect(two.restaurant.slug).toMatch(new RegExp(`^${base}-[a-z0-9]{3}$`))
  })
})
