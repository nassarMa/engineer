import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['@electric-sql/pglite', 'postgres', 'sharp'],
  images: { unoptimized: true },
}

export default nextConfig
