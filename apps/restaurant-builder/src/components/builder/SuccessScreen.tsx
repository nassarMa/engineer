'use client'
import Link from 'next/link'
import { useState } from 'react'
import type { Dictionary, Locale } from '@/lib/i18n'
import { ownerKeyStorage } from './client-utils'
import { useClientValue } from './useClientValue'

export function SuccessScreen({ locale, t, slug, name, url }: { locale: Locale; t: Dictionary; slug: string; name: string; url: string }) {
  const [copied, setCopied] = useState(false)
  const canShare = useClientValue(() => typeof navigator.share === 'function', false)
  const ownerKey = useClientValue(() => ownerKeyStorage(slug).get(), null)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="grid gap-6">
      <div className="card grid gap-5 p-6 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-ok/10 text-ok rise" aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
        </div>
        <div className="rise rise-1">
          <h1 className="text-3xl font-extrabold leading-tight">{t.successTitle}</h1>
          <p className="mt-2 text-ink-soft">{t.successSubtitle}</p>
        </div>
        <div className="rise rise-2 grid gap-1 rounded-2xl bg-cream p-4">
          <p className="text-lg font-bold" dir="auto">{name}</p>
          <a className="break-all text-accent-deep underline underline-offset-4" href={url} target="_blank" rel="noopener noreferrer" dir="ltr" data-testid="site-url">{url}</a>
        </div>
        <div className="rise rise-3 grid gap-2">
          <a className="btn-primary" href={url} target="_blank" rel="noopener noreferrer" data-testid="open-site">{t.openWebsite}</a>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-secondary" onClick={copy} data-testid="copy">{copied ? t.copied : t.copyLink}</button>
            {canShare ? <button className="btn-secondary" onClick={() => navigator.share({ title: name, url }).catch(() => undefined)}>{t.share}</button> : <Link className="btn-secondary" href={`/${locale}/edit/${slug}`}>{t.editDetails}</Link>}
          </div>
          {canShare ? <Link className="btn-secondary" href={`/${locale}/edit/${slug}`}>{t.editDetails}</Link> : null}
        </div>
      </div>
      {ownerKey ? (
        <div className="card grid gap-2 p-5">
          <p className="font-bold">{t.ownerKeyTitle}</p>
          <code className="select-all break-all rounded-xl bg-cream px-3 py-2 font-mono text-sm" dir="ltr" data-testid="owner-key">{ownerKey}</code>
          <p className="text-sm text-ink-soft">{t.ownerKeyHint}</p>
        </div>
      ) : null}
    </div>
  )
}
