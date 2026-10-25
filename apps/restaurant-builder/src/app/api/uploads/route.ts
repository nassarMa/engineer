import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { allowRate, insertUpload } from '@/lib/db/repo'
import { isVercel } from '@/lib/env'
import { clientIp, jsonError } from '@/lib/request'
import { getStorage, usingBlob } from '@/lib/storage'
import { MAX_UPLOAD_BYTES, processUpload, UPLOAD_KINDS, UploadError, type UploadKind } from '@/lib/uploads'

export const runtime = 'nodejs'
export const maxDuration = 60

/** One file per request: multipart field `file`, query `kind=menu|logo|photo`. */
export async function POST(req: Request) {
  const url = new URL(req.url)
  const kind = url.searchParams.get('kind') as UploadKind | null
  if (!kind || !UPLOAD_KINDS.includes(kind)) return jsonError(400, 'bad_kind', 'kind must be menu, logo or photo')
  if (isVercel() && !usingBlob()) return jsonError(503, 'storage_unconfigured', 'File storage is not configured (BLOB_READ_WRITE_TOKEN).')
  const length = Number(req.headers.get('content-length') ?? 0)
  if (length > MAX_UPLOAD_BYTES * 1.1) return jsonError(413, 'too_large', 'File is too large.')

  const db = await getDb()
  const ip = clientIp(req)
  if (!(await allowRate(db, `upload:${ip}`, Number(process.env.UPLOAD_RATE_LIMIT ?? 120), 3600))) return jsonError(429, 'rate_limited', 'Too many uploads. Try again later.')

  let file: File | null = null
  try {
    const form = await req.formData()
    const f = form.get('file')
    if (f instanceof File) file = f
  } catch {
    return jsonError(400, 'bad_body', 'Expected multipart form data with a file.')
  }
  if (!file) return jsonError(400, 'no_file', 'No file was sent.')
  if (file.size > MAX_UPLOAD_BYTES) return jsonError(413, 'too_large', 'File is too large.')

  try {
    const processed = await processUpload(new Uint8Array(await file.arrayBuffer()), kind)
    const { url: publicUrl } = await getStorage().put(processed.key, processed.bytes, processed.mime)
    const row = await insertUpload(db, { kind, mime: processed.mime, bytes: processed.bytes.length, width: processed.width, height: processed.height, storage_key: processed.key, url: publicUrl, ip })
    return NextResponse.json({ id: row.id, url: row.url, mime: row.mime, width: row.width, height: row.height })
  } catch (e) {
    if (e instanceof UploadError) return jsonError(e.code === 'size' ? 413 : 415, e.code, e.message)
    console.error('upload failed', e)
    return jsonError(500, 'upload_failed', 'The file could not be stored.')
  }
}
