'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { Dictionary, Locale } from '@/lib/i18n'
import type { Stage } from '@/lib/schemas'

type View = { id: string; stage: Stage; status: 'waiting' | 'running' | 'failed' | 'done'; error: string | null; retryable: boolean; slug: string; publishedUrl: string | null; attempt: number }

const VISIBLE: Exclude<Stage, 'done'>[] = ['extract', 'brand', 'design', 'content', 'qa', 'publish']

export function BuildProgress({ locale, t, buildId }: { locale: Locale; t: Dictionary; buildId: string }) {
  const router = useRouter()
  const [view, setView] = useState<View | null>(null)
  const [netError, setNetError] = useState(false)
  const busy = useRef(false)
  const stopped = useRef(false)
  const failedRef = useRef(false)

  useEffect(() => {
    stopped.current = false
    async function step(retry = false) {
      if (busy.current || stopped.current) return
      busy.current = true
      try {
        const res = await fetch(`/api/builds/${buildId}/advance`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ retry }) })
        if (!res.ok) throw new Error(String(res.status))
        const v = (await res.json()) as View
        setView(v)
        failedRef.current = v.status === 'failed'
        setNetError(false)
        if (v.status === 'done') {
          stopped.current = true
          router.replace(`/${locale}/done/${v.slug}`)
        }
      } catch {
        setNetError(true)
      } finally {
        busy.current = false
      }
    }
    void step()
    const timer = setInterval(() => {
      if (failedRef.current) return
      void step()
    }, 2500)
    return () => {
      stopped.current = true
      clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildId])

  const currentIndex = view ? VISIBLE.indexOf(view.stage as Exclude<Stage, 'done'>) : 0
  const failed = view?.status === 'failed'

  async function retry() {
    setView((v) => (v ? { ...v, status: 'waiting', error: null } : v))
    failedRef.current = false
    busy.current = false
    const res = await fetch(`/api/builds/${buildId}/advance`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ retry: true }) })
    if (res.ok) setView((await res.json()) as View)
  }

  return (
    <div className="grid gap-6" data-testid="progress" data-stage={view?.stage ?? ''} data-status={view?.status ?? ''}>
      <ol className="card divide-y divide-line">
        {VISIBLE.map((s, i) => {
          const state = failed && i === currentIndex ? 'failed' : i < currentIndex || view?.stage === 'done' ? 'done' : i === currentIndex ? 'active' : 'todo'
          return (
            <li key={s} className="flex items-center gap-4 px-5 py-4" data-testid={`stage-${s}`} data-state={state}>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${state === 'done' ? 'bg-ok text-white' : state === 'active' ? 'bg-ink text-white' : state === 'failed' ? 'bg-danger text-white' : 'bg-stone-100 text-stone-400'}`} aria-hidden="true">
                {state === 'done' ? '✓' : state === 'failed' ? '!' : i + 1}
              </span>
              <span className={`text-[17px] ${state === 'active' ? 'font-bold' : state === 'todo' ? 'text-stone-400' : 'font-semibold'}`}>{t[`stage_${s}` as keyof Dictionary]}</span>
              {state === 'active' ? <span className="ms-auto flex gap-1" aria-hidden="true"><i className="h-2 w-2 rounded-full bg-accent pulse-soft" /><i className="h-2 w-2 rounded-full bg-accent pulse-soft [animation-delay:0.2s]" /><i className="h-2 w-2 rounded-full bg-accent pulse-soft [animation-delay:0.4s]" /></span> : null}
            </li>
          )
        })}
      </ol>
      {failed ? (
        <div className="card grid gap-4 border-red-200 bg-red-50/60 p-5" role="alert" data-testid="build-failed">
          <p className="text-lg font-bold text-danger">{t.buildFailed}</p>
          <p className="text-sm text-ink-soft" dir="auto">{view?.error}</p>
          <div className="flex flex-wrap gap-2">
            {view?.retryable ? <button className="btn-secondary" onClick={retry} data-testid="retry">{t.retry}</button> : null}
            <Link className="btn-secondary" href={`/${locale}`}>{t.startOver}</Link>
          </div>
        </div>
      ) : null}
      {netError && !failed ? <p className="text-center text-sm text-ink-soft">{t.errorGeneric}</p> : null}
    </div>
  )
}
