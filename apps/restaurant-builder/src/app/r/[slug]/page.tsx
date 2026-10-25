import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Site } from '@/components/site/Site'
import { DICTIONARIES } from '@/lib/i18n'
import { buildPalette } from '@/lib/render/themes'
import { loadRestaurant, siteVisible } from '@/lib/site-loader'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> }

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params
  const { preview } = await searchParams
  const r = await loadRestaurant(slug)
  if (!r || !r.site_config || !siteVisible(r, preview)) return { title: 'Not found' }
  const c = r.site_config
  const pal = buildPalette(c.brand)
  const url = r.published_url ?? undefined
  return {
    title: c.content.seoTitle,
    description: c.content.seoDescription,
    robots: r.status === 'published' ? { index: true, follow: true } : { index: false, follow: false },
    alternates: url ? { canonical: url } : undefined,
    openGraph: { type: 'website', title: c.content.seoTitle, description: c.content.seoDescription, url, locale: c.lang, images: c.design.heroPhotoId ? c.photos.filter((p) => p.id === c.design.heroPhotoId).map((p) => ({ url: p.url, width: p.width, height: p.height })) : undefined },
    other: { 'theme-color': pal.bg },
  }
}

export default async function SitePage({ params, searchParams }: Props) {
  const { slug } = await params
  const { preview } = await searchParams
  const r = await loadRestaurant(slug)
  if (!r || !r.site_config || !siteVisible(r, preview)) notFound()
  const cfg = r.site_config
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'Restaurant', name: cfg.content.displayName, telephone: cfg.restaurant.phone, address: cfg.restaurant.address, url: r.published_url ?? undefined, servesCuisine: cfg.brand.cuisine, image: cfg.photos[0]?.url }) }} />
      <Site config={cfg} fallbackNote={DICTIONARIES[cfg.lang].menuFallbackNote} />
    </>
  )
}
