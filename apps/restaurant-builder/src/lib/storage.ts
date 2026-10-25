import fs from 'node:fs/promises'
import path from 'node:path'
import { appUrl, dataDir } from './env'

/**
 * File storage: Vercel Blob when BLOB_READ_WRITE_TOKEN is set, otherwise the
 * local filesystem (served by /api/files/[key]). Keys are opaque and random.
 */
export interface Storage {
  put(key: string, bytes: Uint8Array, mime: string): Promise<{ url: string }>
  get(key: string, url: string): Promise<Uint8Array>
}

export function usingBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

const blobStorage: Storage = {
  async put(key, bytes, mime) {
    const { put } = await import('@vercel/blob')
    const res = await put(`uploads/${key}`, Buffer.from(bytes), { access: 'public', contentType: mime, addRandomSuffix: false })
    return { url: res.url }
  },
  async get(_key, url) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`blob fetch failed: ${res.status}`)
    return new Uint8Array(await res.arrayBuffer())
  },
}

function localRoot(): string {
  return path.resolve(process.cwd(), dataDir(), 'uploads')
}

const localStorageAdapter: Storage = {
  async put(key, bytes) {
    await fs.mkdir(localRoot(), { recursive: true })
    await fs.writeFile(path.join(localRoot(), key), bytes)
    return { url: `${appUrl()}/api/files/${key}` }
  },
  async get(key) {
    return new Uint8Array(await fs.readFile(path.join(localRoot(), key)))
  },
}

export function getStorage(): Storage {
  return usingBlob() ? blobStorage : localStorageAdapter
}

export function safeKey(key: string): boolean {
  return /^[A-Za-z0-9_-]{8,80}\.(webp|png|jpg|pdf)$/.test(key)
}
