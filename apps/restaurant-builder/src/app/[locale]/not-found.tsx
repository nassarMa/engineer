import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-5xl font-extrabold">404</p>
      <p className="text-ink-soft">This page does not exist. · هذه الصفحة غير موجودة. · הדף הזה לא קיים.</p>
      <Link href="/" className="btn-secondary">Home</Link>
    </main>
  )
}
