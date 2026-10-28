'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { LOCALES, LOCALE_NAMES, type Dictionary, type Locale } from '@/lib/i18n'
import { ACCEPT_IMAGE, ACCEPT_MENU, ownerKeyStorage } from './client-utils'
import { FileField, type Picked } from './FileField'

type Errors = Partial<Record<'name' | 'menu' | 'phone' | 'address' | 'form', string>>

export function BuilderForm({ locale, t }: { locale: Locale; t: Dictionary }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [description, setDescription] = useState('')
  const [websiteLang, setWebsiteLang] = useState<Locale>(locale)
  const [menu, setMenu] = useState<Picked[]>([])
  const [logo, setLogo] = useState<Picked[]>([])
  const [logoInMenu, setLogoInMenu] = useState(false)
  const [photos, setPhotos] = useState<Picked[]>([])
  const [errors, setErrors] = useState<Errors>({})
  const [submitting, setSubmitting] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  // Marks the form interactive; file pickers only work once React has hydrated.
  useEffect(() => {
    formRef.current?.setAttribute('data-hydrated', 'true')
  }, [])

  const uploading = useMemo(() => [...menu, ...logo, ...photos].some((p) => p.status === 'uploading'), [menu, logo, photos])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const next: Errors = {}
    if (!name.trim()) next.name = t.errorRequired
    if (menu.filter((p) => p.status === 'done').length === 0) next.menu = t.errorMenu
    if (phone.replace(/\D/g, '').length < 7) next.phone = t.errorPhone
    if (address.trim().length < 3) next.address = t.errorRequired
    setErrors(next)
    if (Object.keys(next).length > 0) {
      document.querySelector('[data-error="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/builds', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          locale,
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          description: description.trim(),
          websiteLang,
          logoMode: logo.some((p) => p.status === 'done') ? 'upload' : logoInMenu ? 'in-menu' : 'none',
          menuUploadIds: menu.filter((p) => p.status === 'done').map((p) => p.result!.id),
          logoUploadId: logo.find((p) => p.status === 'done')?.result?.id ?? null,
          photoUploadIds: photos.filter((p) => p.status === 'done').map((p) => p.result!.id),
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string; issues?: { path: string; message: string }[] } } | null
        const code = body?.error?.code
        if (code === 'invalid' && body?.error?.issues?.length) {
          // Point at the field the server rejected instead of a vague failure.
          const fieldErrors: Errors = {}
          for (const issue of body.error.issues) {
            const root = issue.path.split('.')[0]
            if (root === 'name' || root === 'address') fieldErrors[root] = t.errorInvalidField
            else if (root === 'phone') fieldErrors.phone = t.errorPhone
            else if (root === 'menuUploadIds') fieldErrors.menu = t.errorMenu
            else fieldErrors.form = t.errorInvalidField
          }
          setErrors(fieldErrors)
          setSubmitting(false)
          document.querySelector('[data-error="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          return
        }
        setErrors({ form: code === 'rate_limited' ? t.errorTooMany : code === 'setup_incomplete' || code === 'storage_unconfigured' ? `${t.setupMissing} ${body?.error?.message ?? ''}` : t.errorGeneric })
        setSubmitting(false)
        return
      }
      const data = (await res.json()) as { buildId: string; slug: string; ownerKey: string }
      ownerKeyStorage(data.slug).set(data.ownerKey)
      router.push(`/${locale}/build/${data.buildId}`)
    } catch {
      setErrors({ form: t.errorGeneric })
      setSubmitting(false)
    }
  }

  const Req = <span className="tag tag-req">{t.required}</span>
  const Opt = <span className="tag tag-opt">{t.optional}</span>

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="grid gap-7" data-testid="builder-form">
      <section className="grid gap-2" data-error={Boolean(errors.name)}>
        <label className="label" htmlFor="name">{t.nameLabel}{Req}</label>
        <input id="name" name="name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePlaceholder} autoComplete="organization" maxLength={80} />
        {errors.name ? <p className="text-sm font-semibold text-danger">{errors.name}</p> : null}
      </section>

      <section className="grid gap-2" data-error={Boolean(errors.menu)}>
        <div>
          <span className="label">{t.menuLabel}{Req}</span>
          <p className="hint">{t.menuHint}</p>
        </div>
        <FileField t={t} kind="menu" accept={ACCEPT_MENU} multiple max={8} label={t.menuLabel} addLabel={t.menuAdd} camera files={menu} onChange={setMenu} testId="menu" />
        {errors.menu ? <p className="text-sm font-semibold text-danger">{errors.menu}</p> : null}
      </section>

      <section className="grid gap-2" data-error={Boolean(errors.phone)}>
        <label className="label" htmlFor="phone">{t.phoneLabel}{Req}</label>
        <input id="phone" name="phone" className="field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.phonePlaceholder} type="tel" inputMode="tel" autoComplete="tel" dir="ltr" />
        {errors.phone ? <p className="text-sm font-semibold text-danger">{errors.phone}</p> : null}
      </section>

      <section className="grid gap-2" data-error={Boolean(errors.address)}>
        <label className="label" htmlFor="address">{t.addressLabel}{Req}</label>
        <input id="address" name="address" className="field" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t.addressPlaceholder} autoComplete="street-address" maxLength={200} />
        {errors.address ? <p className="text-sm font-semibold text-danger">{errors.address}</p> : null}
      </section>

      <section className="grid gap-3">
        <span className="label">{t.logoLabel}{Opt}</span>
        {!logoInMenu ? <FileField t={t} kind="logo" accept={ACCEPT_IMAGE} multiple={false} max={1} label={t.logoLabel} addLabel={t.logoAdd} files={logo} onChange={setLogo} testId="logo" /> : null}
        <label className="flex min-h-12 cursor-pointer items-center gap-3 text-[16px]">
          <input type="checkbox" className="h-6 w-6 rounded-md accent-amber-600" checked={logoInMenu} onChange={(e) => { setLogoInMenu(e.target.checked); if (e.target.checked) setLogo([]) }} data-testid="logo-in-menu" />
          {t.logoInMenu}
        </label>
      </section>

      <section className="grid gap-2">
        <label className="label" htmlFor="description">{t.descriptionLabel}{Opt}</label>
        <textarea id="description" name="description" className="field min-h-28 resize-y" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t.descriptionPlaceholder} maxLength={600} rows={3} />
        <p className="hint">{t.descriptionHint}</p>
      </section>

      <section className="grid gap-2">
        <div>
          <span className="label">{t.photosLabel}{Opt}</span>
          <p className="hint">{t.photosHint}</p>
        </div>
        <FileField t={t} kind="photo" accept={ACCEPT_IMAGE} multiple max={12} label={t.photosLabel} addLabel={t.photosAdd} files={photos} onChange={setPhotos} testId="photos" />
      </section>

      <section className="card grid gap-3 p-5">
        <div>
          <span className="label">{t.websiteLangTitle}</span>
          <p className="hint">{t.websiteLangHint}</p>
        </div>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t.websiteLangTitle}>
          {LOCALES.map((l) => (
            <button key={l} type="button" role="radio" aria-checked={websiteLang === l} data-testid={`site-lang-${l}`} onClick={() => setWebsiteLang(l)} lang={l} className={`pill ${websiteLang === l ? 'border-ink bg-ink text-white' : 'border-line bg-card text-ink'}`}>
              {LOCALE_NAMES[l]}
            </button>
          ))}
        </div>
      </section>

      {errors.form ? <p className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-danger" role="alert">{errors.form}</p> : null}

      <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-cream via-cream to-transparent px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-6">
        <button type="submit" className="btn-primary shadow-xl" disabled={submitting || uploading} data-testid="build">
          {submitting ? t.building : uploading ? t.uploading : t.build}
          {!submitting && !uploading ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="rtl:rotate-180"><path d="M5 12h14M13 6l6 6-6 6" /></svg> : null}
        </button>
      </div>
    </form>
  )
}
