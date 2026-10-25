'use client'
import { useEffect, useState } from 'react'
import type { Dictionary, Locale } from '@/lib/i18n'
import { ownerKeyStorage } from './client-utils'
import { useClientValue } from './useClientValue'

type Basics = { name: string; phone: string; address: string; description: string; publishedUrl: string | null }

export function EditForm({ t, slug, initialKey }: { locale: Locale; t: Dictionary; slug: string; initialKey: string | null }) {
  const stored = useClientValue(() => ownerKeyStorage(slug).get(), null)
  const [typed, setTyped] = useState<string | null>(null)
  const key = typed ?? initialKey ?? stored ?? ''
  const [data, setData] = useState<Basics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!key) return
    let cancelled = false
    fetch(`/api/restaurants/${slug}`, { headers: { 'x-owner-key': key } })
      .then(async (res) => {
        if (cancelled) return
        if (res.status === 403) {
          setError(t.errorOwnerKey)
          setData(null)
          return
        }
        if (!res.ok) throw new Error()
        setError(null)
        setData((await res.json()) as Basics)
        ownerKeyStorage(slug).set(key)
      })
      .catch(() => !cancelled && setError(t.errorGeneric))
    return () => {
      cancelled = true
    }
  }, [key, slug, t])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!data) return
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch(`/api/restaurants/${slug}`, { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-owner-key': key }, body: JSON.stringify({ name: data.name, phone: data.phone, address: data.address, description: data.description }) })
      if (res.status === 403) setError(t.errorOwnerKey)
      else if (!res.ok) setError(t.errorGeneric)
      else {
        setError(null)
        setSaved(true)
      }
    } catch {
      setError(t.errorGeneric)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="grid gap-6" data-testid="edit-form">
      <section className="grid gap-2">
        <label className="label" htmlFor="key">{t.ownerKeyLabel}</label>
        <input id="key" className="field font-mono" value={key} onChange={(e) => setTyped(e.target.value.trim())} dir="ltr" autoComplete="off" data-testid="key-input" />
      </section>
      {data ? (
        <>
          <section className="grid gap-2"><label className="label" htmlFor="e-name">{t.nameLabel}</label><input id="e-name" className="field" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} maxLength={80} /></section>
          <section className="grid gap-2"><label className="label" htmlFor="e-phone">{t.phoneLabel}</label><input id="e-phone" className="field" type="tel" dir="ltr" value={data.phone} onChange={(e) => setData({ ...data, phone: e.target.value })} /></section>
          <section className="grid gap-2"><label className="label" htmlFor="e-address">{t.addressLabel}</label><input id="e-address" className="field" value={data.address} onChange={(e) => setData({ ...data, address: e.target.value })} maxLength={200} /></section>
          <section className="grid gap-2"><label className="label" htmlFor="e-desc">{t.descriptionLabel}</label><textarea id="e-desc" className="field min-h-28" value={data.description} onChange={(e) => setData({ ...data, description: e.target.value })} maxLength={600} /></section>
          <button className="btn-primary" disabled={saving} data-testid="save">{saved ? t.saved : t.save}</button>
          {data.publishedUrl ? <a className="btn-secondary" href={data.publishedUrl} target="_blank" rel="noopener noreferrer">{t.openWebsite}</a> : null}
        </>
      ) : null}
      {error ? <p className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-danger" role="alert">{error}</p> : null}
    </form>
  )
}
