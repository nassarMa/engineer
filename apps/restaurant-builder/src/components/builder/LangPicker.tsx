'use client'
import { useRouter } from 'next/navigation'
import { LOCALES, LOCALE_NAMES, type Locale } from '@/lib/i18n'

export function LangPicker() {
  const router = useRouter()
  return (
    <div className="grid gap-3" role="list">
      {LOCALES.map((l, i) => (
        <button
          key={l}
          role="listitem"
          data-testid={`lang-${l}`}
          onClick={() => {
            router.push(`/${l}`)
          }}
          className={`card rise rise-${i + 1} flex min-h-20 items-center justify-between px-6 text-start transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99]`}
          lang={l}
          dir={l === 'en' ? 'ltr' : 'rtl'}
        >
          <span className="text-2xl font-bold">{LOCALE_NAMES[l as Locale]}</span>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent-deep" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={l === 'en' ? '' : 'rotate-180'}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </span>
        </button>
      ))}
    </div>
  )
}
