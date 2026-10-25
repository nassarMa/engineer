import { randomBytes } from 'node:crypto'
import sharp from 'sharp'

/**
 * Upload handling: identify the real file type from its bytes, re-encode
 * images (strips metadata, bounds size), keep PDFs as-is after a header check.
 */

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024
export const UPLOAD_KINDS = ['menu', 'logo', 'photo'] as const
export type UploadKind = (typeof UPLOAD_KINDS)[number]

export type ProcessedUpload = { key: string; mime: 'image/webp' | 'image/png' | 'application/pdf'; bytes: Uint8Array; width: number | null; height: number | null }

export class UploadError extends Error {
  constructor(
    message: string,
    readonly code: 'type' | 'size' | 'corrupt',
  ) {
    super(message)
  }
}

export function sniff(bytes: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf' | null {
  if (bytes.length < 12) return null
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp'
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'application/pdf'
  return null
}

const MAX_SIDE: Record<UploadKind, number> = { menu: 2200, logo: 1024, photo: 1800 }

export async function processUpload(bytes: Uint8Array, kind: UploadKind): Promise<ProcessedUpload> {
  if (bytes.length > MAX_UPLOAD_BYTES) throw new UploadError('File is too large.', 'size')
  const mime = sniff(bytes)
  if (!mime) throw new UploadError('Unsupported file type.', 'type')
  if (mime === 'application/pdf') {
    if (kind !== 'menu') throw new UploadError('PDF is only accepted for the menu.', 'type')
    return { key: `${randomBytes(16).toString('base64url')}.pdf`, mime, bytes, width: null, height: null }
  }
  try {
    const image = sharp(Buffer.from(bytes), { failOn: 'error', limitInputPixels: 30_000_000 }).rotate()
    const meta = await image.metadata()
    if (!meta.width || !meta.height) throw new UploadError('Image could not be read.', 'corrupt')
    const resized = image.resize({ width: MAX_SIDE[kind], height: MAX_SIDE[kind], fit: 'inside', withoutEnlargement: true })
    // Logos keep transparency as PNG; everything else becomes WebP.
    if (kind === 'logo' && meta.hasAlpha) {
      const out = await resized.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true })
      return { key: `${randomBytes(16).toString('base64url')}.png`, mime: 'image/png', bytes: new Uint8Array(out.data), width: out.info.width, height: out.info.height }
    }
    const out = await resized.webp({ quality: 84 }).toBuffer({ resolveWithObject: true })
    return { key: `${randomBytes(16).toString('base64url')}.webp`, mime: 'image/webp', bytes: new Uint8Array(out.data), width: out.info.width, height: out.info.height }
  } catch (e) {
    if (e instanceof UploadError) throw e
    throw new UploadError('Image could not be read.', 'corrupt')
  }
}

/** Smaller copy for sending to the model (keeps token use bounded). */
export async function thumbnail(bytes: Uint8Array, maxSide: number): Promise<{ bytes: Uint8Array; mime: 'image/webp'; width: number; height: number }> {
  const out = await sharp(Buffer.from(bytes)).resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true })
  return { bytes: new Uint8Array(out.data), mime: 'image/webp', width: out.info.width, height: out.info.height }
}

/** Crop a fractional box out of an image; returns null when the box is unusable. */
export async function cropBox(bytes: Uint8Array, box: { x: number; y: number; w: number; h: number }): Promise<{ bytes: Uint8Array; mime: 'image/webp'; width: number; height: number } | null> {
  const meta = await sharp(Buffer.from(bytes)).metadata()
  if (!meta.width || !meta.height) return null
  const cx = Math.max(0, Math.min(1, box.x))
  const cy = Math.max(0, Math.min(1, box.y))
  const left = Math.round(cx * meta.width)
  const top = Math.round(cy * meta.height)
  const width = Math.min(meta.width - left, Math.round(Math.max(0, Math.min(1 - cx, box.w)) * meta.width))
  const height = Math.min(meta.height - top, Math.round(Math.max(0, Math.min(1 - cy, box.h)) * meta.height))
  if (width < 96 || height < 48) return null
  if (width / height > 6 || height / width > 4) return null
  const out = await sharp(Buffer.from(bytes)).extract({ left, top, width, height }).webp({ quality: 90 }).toBuffer({ resolveWithObject: true })
  return { bytes: new Uint8Array(out.data), mime: 'image/webp', width: out.info.width, height: out.info.height }
}
