import { getStorage, safeKey, usingBlob } from '@/lib/storage'

/** Serves locally stored uploads (development without Vercel Blob). */
export async function GET(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params
  if (usingBlob() || !safeKey(key)) return new Response('Not found', { status: 404 })
  try {
    const bytes = await getStorage().get(key, '')
    const mime = key.endsWith('.pdf') ? 'application/pdf' : key.endsWith('.png') ? 'image/png' : key.endsWith('.jpg') ? 'image/jpeg' : 'image/webp'
    return new Response(Buffer.from(bytes), { headers: { 'content-type': mime, 'cache-control': 'public, max-age=31536000, immutable' } })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
