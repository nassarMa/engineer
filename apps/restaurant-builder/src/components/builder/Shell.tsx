import Link from 'next/link'
import type { Dictionary, Locale } from '@/lib/i18n'

const FONT_HREF: Record<Locale, string> = {
  ar: 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap',
  en: 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap',
  he: 'https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;700;800&display=swap',
}

export function fontLink(locale: Locale) {
  return FONT_HREF[locale]
}

export function Shell({ locale, t, title, subtitle, back, children }: { locale: Locale; t: Dictionary; title: string; subtitle?: string; back?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 pb-6 pt-4">
      <header className="mb-6 flex items-center justify-between gap-3">
        {back ? (
          <Link href={back} className="flex min-h-11 items-center gap-1 text-[15px] font-semibold text-ink-soft">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="rtl:rotate-180"><path d="M15 6l-6 6 6 6" /></svg>
            {t.back}
          </Link>
        ) : (
          <span />
        )}
        <Link href="/" className="flex min-h-11 items-center text-[13px] font-semibold text-ink-soft underline-offset-4 hover:underline" data-testid="change-language">
          {t.changeLanguage} · {locale.toUpperCase()}
        </Link>
      </header>
      {title ? (
        <div className="mb-6">
          <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-1.5 text-ink-soft">{subtitle}</p> : null}
        </div>
      ) : null}
      {children}
    </div>
  )
}
