import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['@electric-sql/pglite', 'postgres', 'sharp'],
  images: { unoptimized: true },
  async headers() {
    const common = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
    ]
    return [
      // Builder pages hold the owner key in the browser: never framable.
      { source: '/((?!r/).*)', headers: [...common, { key: 'X-Frame-Options', value: 'DENY' }] },
      { source: '/r/:slug*', headers: common },
    ]
  },
}

export default nextConfig
