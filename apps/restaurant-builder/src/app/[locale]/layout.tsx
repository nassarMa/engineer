import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import '../globals.css'
import { fontLink } from '@/components/builder/Shell'
import { dirOf, isLocale, LOCALES, t } from '@/lib/i18n'

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const d = t(locale)
  return { title: { default: d.appName, template: `%s · ${d.appName}` }, description: d.welcomeSubtitle, robots: { index: false } }
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#faf7f2' }

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  return (
    <html lang={locale} dir={dirOf(locale)}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={fontLink(locale)} />
      </head>
      <body>{children}</body>
    </html>
  )
}
