import { getStorage, safeKey, usingBlob } from '@/lib/storage'

/** Serves locally stored uploads (development without Vercel Blob). */
export async function GET(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params
  if (usingBlob() || !safeKey(key)) return new Response('Not found', { status: 404 })
  try {
    const bytes = await getStorage().get(key, '')
    const mime = key.endsWith('.pdf') ? 'application/pdf' : key.endsWith('.png') ? 'image/png' : key.endsWith('.jpg') ? 'image/jpeg' : 'image/webp'
    const headers: Record<string, string> = { 'content-type': mime, 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' }
    if (mime === 'application/pdf') {
      headers['content-disposition'] = 'attachment; filename="menu.pdf"'
      headers['content-security-policy'] = 'sandbox'
    }
    return new Response(Buffer.from(bytes), { headers })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
