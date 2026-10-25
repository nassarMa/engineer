import type { Metadata, Viewport } from 'next'
import '../globals.css'

export const metadata: Metadata = {
  title: 'AI Restaurant Website Builder',
  description: 'Upload your menu, add a few details, and let AI build your restaurant website.',
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#faf7f2' }

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- app router, one root layout per group */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Cairo:wght@700&family=Heebo:wght@700&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  )
}
