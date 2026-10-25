import { notFound } from 'next/navigation'
import { Shell } from '@/components/builder/Shell'
import { SuccessScreen } from '@/components/builder/SuccessScreen'
import { isLocale, t } from '@/lib/i18n'
import { loadRestaurant } from '@/lib/site-loader'

export const dynamic = 'force-dynamic'

export default async function DonePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()
  const r = await loadRestaurant(slug)
  if (!r || r.status !== 'published' || !r.published_url || !r.verified_at) notFound()
  const d = t(locale)
  return (
    <Shell locale={locale} t={d} title="" >
      <SuccessScreen locale={locale} t={d} slug={r.slug} name={r.site_config?.content.displayName ?? r.name} url={r.published_url} />
    </Shell>
  )
}
