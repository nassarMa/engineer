import type { Locale } from './schemas'

/** URL slug from any script; falls back to a random word when nothing is Latin. */
export function slugify(name: string): string {
  const latin = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
  return latin.length >= 3 ? latin : ''
}

const RESERVED = new Set(['www', 'api', 'app', 'admin', 'r', 'static', 'assets', 'mail', 'ftp', 'edit', 'build', 'ar', 'en', 'he'])

export function isReservedSlug(slug: string): boolean {
  return RESERVED.has(slug)
}

export function randomSuffix(length = 4): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}

/** tel: href with only digits and a leading plus; null when it isn't a phone number. */
export function telHref(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, '')
  const normalized = digits.startsWith('+') ? '+' + digits.slice(1).replace(/\+/g, '') : digits.replace(/\+/g, '')
  const count = normalized.replace(/\D/g, '').length
  if (count < 7 || count > 15) return null
  return `tel:${normalized}`
}

export function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`
}

export function dirOf(lang: Locale): 'rtl' | 'ltr' {
  return lang === 'en' ? 'ltr' : 'rtl'
}

/** Script detection for picking fonts that actually cover the text. */
export function scriptsIn(text: string): { arabic: boolean; hebrew: boolean; latin: boolean } {
  return {
    arabic: /[؀-ۿݐ-ݿ]/.test(text),
    hebrew: /[֐-׿]/.test(text),
    latin: /[A-Za-z]/.test(text),
  }
}
