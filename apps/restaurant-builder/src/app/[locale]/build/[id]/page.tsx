import { notFound } from 'next/navigation'
import { BuildProgress } from '@/components/builder/BuildProgress'
import { Shell } from '@/components/builder/Shell'
import { isLocale, t } from '@/lib/i18n'

export default async function BuildPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  if (!isLocale(locale) || !/^[0-9a-f-]{36}$/.test(id)) notFound()
  const d = t(locale)
  return (
    <Shell locale={locale} t={d} title={d.progressTitle} subtitle={d.progressSubtitle}>
      <BuildProgress locale={locale} t={d} buildId={id} />
    </Shell>
  )
}
