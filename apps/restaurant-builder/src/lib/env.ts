/** Central place for reading configuration; nothing else touches process.env. */

export function appUrl(): string {
  const explicit = process.env.APP_URL?.replace(/\/$/, '')
  if (explicit) return explicit
  // Preview deployments must verify themselves, not the production domain.
  if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return `http://localhost:${process.env.PORT ?? 3000}`
}

export function platformDomain(): string | null {
  const d = process.env.PLATFORM_DOMAIN?.trim().toLowerCase().replace(/^\.+|\.+$/g, '')
  return d || null
}

export function isVercel(): boolean {
  return process.env.VERCEL === '1'
}

export function aiProviderName(): 'anthropic' | 'mock' {
  const explicit = process.env.AI_PROVIDER
  if (explicit === 'mock' || explicit === 'anthropic') return explicit
  return process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'mock'
}

export function aiModel(): string {
  return process.env.AI_MODEL || 'claude-opus-5-5'
}

export function dataDir(): string {
  return process.env.DATA_DIR || '.data'
}

/** What is missing for a real deployment; empty when everything is configured. */
export function setupProblems(): string[] {
  const problems: string[] = []
  // The mock provider must be an explicit choice (AI_PROVIDER=mock), never a silent fallback on a real deployment.
  if (!process.env.ANTHROPIC_API_KEY && process.env.AI_PROVIDER !== 'mock') problems.push('ANTHROPIC_API_KEY is not set.')
  if (isVercel()) {
    if (!process.env.DATABASE_URL) problems.push('DATABASE_URL is not set; Vercel has no persistent disk.')
    if (!process.env.BLOB_READ_WRITE_TOKEN) problems.push('BLOB_READ_WRITE_TOKEN is not set; uploads cannot be stored.')
  }
  return problems
}

/** Headers for the app fetching its own pages (Vercel deployment protection on previews). */
export function selfFetchHeaders(): Record<string, string> {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  return secret ? { 'x-vercel-protection-bypass': secret } : {}
}

export function publicSiteUrl(slug: string): string {
  const domain = platformDomain()
  if (domain) return `https://${slug}.${domain}`
  return `${appUrl()}/r/${slug}`
}
