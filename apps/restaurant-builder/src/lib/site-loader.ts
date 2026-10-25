import { cache } from 'react'
import { getDb } from './db'
import { getRestaurantBySlug, type RestaurantRow } from './db/repo'

/** One DB read per request for the site layout + page + metadata. */
export const loadRestaurant = cache(async (slug: string): Promise<RestaurantRow | null> => {
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return null
  const db = await getDb()
  return getRestaurantBySlug(db, slug)
})

/** A site is visible when published, or when the caller holds its preview token. */
export function siteVisible(r: RestaurantRow, preview: string | undefined): boolean {
  if (!r.site_config) return false
  if (r.status === 'published') return true
  return Boolean(preview) && preview === r.preview_token
}
