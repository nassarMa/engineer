import { notFound } from 'next/navigation'
import { loadRestaurant, siteVisible } from '@/lib/site-loader'
import { cssVariables, fontsFor, googleFontsHref } from '@/lib/render/themes'
import type { CSSProperties } from 'react'
import '@/components/site/site.css'

export const dynamic = 'force-dynamic'

/** Root layout for published sites: one <html> per restaurant with its own lang, dir and fonts. */
export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const r = await loadRestaurant(slug)
  if (!r || !r.site_config) notFound()
  const cfg = r.site_config
  const fonts = fontsFor(cfg.brand.fontPair, cfg.lang)
  const vars = cssVariables(cfg.brand, cfg.lang) as CSSProperties
  return (
    <html lang={cfg.lang} dir={cfg.dir} style={vars}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={googleFontsHref(fonts)} />
      </head>
      <body style={{ background: 'var(--bg)', margin: 0 }}>{children}</body>
    </html>
  )
}

export { siteVisible }
