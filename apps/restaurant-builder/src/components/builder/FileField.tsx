'use client'
/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from 'react'
import type { Dictionary } from '@/lib/i18n'
import { uploadFile, type UploadResult } from './client-utils'

export type Picked = { localId: string; name: string; preview: string | null; status: 'uploading' | 'done' | 'error'; result?: UploadResult; error?: string }

type Props = {
  t: Dictionary
  kind: 'menu' | 'logo' | 'photo'
  accept: string
  multiple: boolean
  max: number
  label: string
  addLabel: string
  camera?: boolean
  files: Picked[]
  /** State setter from the parent; receives an updater so concurrent uploads never clobber each other. */
  onChange: (update: (prev: Picked[]) => Picked[]) => void
  testId: string
}

export function FileField({ t, kind, accept, multiple, max, addLabel, camera, files, onChange, testId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const update = onChange

  async function add(list: FileList | File[]) {
    const room = max - files.length
    const incoming = Array.from(list).slice(0, Math.max(0, room))
    if (incoming.length === 0) return
    const picked: Picked[] = incoming.map((f) => ({
      localId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: f.name,
      preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
      status: 'uploading',
    }))
    update((prev) => [...prev, ...picked])
    await Promise.all(
      incoming.map(async (file, i) => {
        const id = picked[i].localId
        try {
          if (!accept.split(',').includes(file.type)) throw new Error('type')
          const result = await uploadFile(file, kind)
          update((prev) => prev.map((p) => (p.localId === id ? { ...p, status: 'done', result } : p)))
        } catch (e) {
          const code = (e as Error).message
          const msg = code === 'type' ? t.errorFileType : code === 'too_large' || code === 'size' ? t.errorFileSize : t.errorUpload
          update((prev) => prev.map((p) => (p.localId === id ? { ...p, status: 'error', error: msg } : p)))
        }
      }),
    )
  }

  function remove(localId: string) {
    update((prev) => prev.filter((p) => p.localId !== localId))
  }

  const full = files.length >= max
  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void add(e.dataTransfer.files)
        }}
        className={`rounded-2xl border-2 border-dashed p-3 transition ${dragging ? 'border-accent bg-accent-soft/40' : 'border-line bg-card'}`}
      >
        {files.length > 0 ? (
          <ul className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {files.map((p) => (
              <li key={p.localId} className="relative aspect-square overflow-hidden rounded-xl border border-line bg-stone-50" data-testid={`${testId}-item`} data-status={p.status}>
                {p.preview ? <img src={p.preview} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center p-2 text-center text-xs font-semibold text-ink-soft">PDF<br />{p.name}</div>}
                {p.status === 'uploading' ? <div className="absolute inset-0 flex items-center justify-center bg-white/60 text-xs font-semibold text-ink pulse-soft">{t.uploading}</div> : null}
                {p.status === 'error' ? <div className="absolute inset-0 flex items-center justify-center bg-red-50/90 p-1 text-center text-[11px] font-semibold text-danger">{p.error}</div> : null}
                <button type="button" onClick={() => remove(p.localId)} aria-label={t.remove} className="absolute end-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white">
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={full} onClick={() => inputRef.current?.click()} className="btn-secondary flex-1 disabled:opacity-40" data-testid={`${testId}-add`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            {addLabel}
          </button>
          {camera ? (
            <button type="button" disabled={full} onClick={() => cameraRef.current?.click()} className="btn-secondary disabled:opacity-40 sm:hidden" aria-label={t.menuCamera}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
            </button>
          ) : null}
        </div>
        <input ref={inputRef} type="file" accept={accept} multiple={multiple} className="sr-only" data-testid={`${testId}-input`} onChange={(e) => { if (e.target.files) void add(e.target.files); e.target.value = '' }} />
        {camera ? <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { if (e.target.files) void add(e.target.files); e.target.value = '' }} /> : null}
      </div>
    </div>
  )
}
