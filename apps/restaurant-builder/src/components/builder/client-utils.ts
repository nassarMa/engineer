'use client'

/** Downscale big images in the browser so uploads stay under the per-request limit. */
export async function prepareFile(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  if (file.size < 1_200_000) return file
  try {
    const bitmap = await createImageBitmap(file)
    const max = 2000
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (!blob) return file
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}

export type UploadResult = { id: string; url: string; mime: string; width: number | null; height: number | null }

export async function uploadFile(file: File, kind: 'menu' | 'logo' | 'photo'): Promise<UploadResult> {
  const prepared = await prepareFile(file)
  const form = new FormData()
  form.append('file', prepared)
  const res = await fetch(`/api/uploads?kind=${kind}`, { method: 'POST', body: form })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null
    throw new Error(body?.error?.code ?? `http_${res.status}`)
  }
  return (await res.json()) as UploadResult
}

export const ACCEPT_MENU = 'image/jpeg,image/png,image/webp,application/pdf'
export const ACCEPT_IMAGE = 'image/jpeg,image/png,image/webp'

export function ownerKeyStorage(slug: string) {
  const key = `rb:owner:${slug}`
  return {
    get(): string | null {
      try {
        return localStorage.getItem(key)
      } catch {
        return null
      }
    },
    set(v: string) {
      try {
        localStorage.setItem(key, v)
      } catch {
        /* private mode */
      }
    },
  }
}
