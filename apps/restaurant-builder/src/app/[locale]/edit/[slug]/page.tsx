import { notFound } from 'next/navigation'
import { EditForm } from '@/components/builder/EditForm'
import { Shell } from '@/components/builder/Shell'
import { isLocale, t } from '@/lib/i18n'

export default async function EditPage({ params, searchParams }: { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<{ key?: string }> }) {
  const { locale, slug } = await params
  const { key } = await searchParams
  if (!isLocale(locale) || !/^[a-z0-9-]{1,60}$/.test(slug)) notFound()
  const d = t(locale)
  return (
    <Shell locale={locale} t={d} title={d.editTitle} subtitle={d.editSubtitle} back={`/${locale}`}>
      <EditForm locale={locale} t={d} slug={slug} initialKey={key ?? null} />
    </Shell>
  )
}
