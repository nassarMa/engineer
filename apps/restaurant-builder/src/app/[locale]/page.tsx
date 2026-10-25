import { notFound } from 'next/navigation'
import { BuilderForm } from '@/components/builder/BuilderForm'
import { Shell } from '@/components/builder/Shell'
import { isLocale, t } from '@/lib/i18n'

export default async function BuilderPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const d = t(locale)
  return (
    <Shell locale={locale} t={d} title={d.formTitle} subtitle={d.formSubtitle} back="/">
      <BuilderForm locale={locale} t={d} />
    </Shell>
  )
}
