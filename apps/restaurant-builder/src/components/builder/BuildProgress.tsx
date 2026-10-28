'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { Dictionary, Locale } from '@/lib/i18n'
import type { Stage } from '@/lib/schemas'

type View = {
  id: string
  stage: Stage
  status: 'waiting' | 'running' | 'failed' | 'done'
  error: string | null
  retryable: boolean
  runningFor: number | null
  staleAfter: number
  slug: string
  publishedUrl: string | null
  attempt: number
}

const VISIBLE: Exclude<Stage, 'done'>[] = ['extract', 'brand', 'design', 'qa', 'publish']
/** Typical seconds per stage, used only to animate the bar smoothly. */
const EXPECTED: Record<Exclude<Stage, 'done'>, number> = { extract: 35, brand: 6, design: 20, qa: 3, publish: 3 }
const TOTAL = Object.values(EXPECTED).reduce((a, b) => a + b, 0)

/**
 * The build runs server-side one stage per request. This screen does two
 * independent things: it keeps a cheap status poll going so the user always
 * sees live state, and it fires the next stage whenever the server reports
 * the build is waiting. Nothing here blocks on the slow AI calls.
 */
export function BuildProgress({ locale, t, buildId }: { locale: Locale; t: Dictionary; buildId: string }) {
  const router = useRouter()
  const [view, setView] = useState<View | null>(null)
  const [netError, setNetError] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [stageElapsed, setStageElapsed] = useState(0)
  const [tick, setTick] = useState(0)
  const advancing = useRef(false)
  const stopped = useRef(false)
  const started = useRef(0)
  const stageStarted = useRef<{ stage: string; at: number }>({ stage: '', at: 0 })

  useEffect(() => {
    stopped.current = false
    started.current = Date.now()
    stageStarted.current = { stage: '', at: Date.now() }

    async function advance(retry = false) {
      if (advancing.current || stopped.current) return
      advancing.current = true
      try {
        const res = await fetch(`/api/builds/${buildId}/advance`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ retry }) })
        if (res.ok) apply((await res.json()) as View)
      } catch {
        /* the status poll will show what happened */
      } finally {
        advancing.current = false
      }
    }

    function apply(v: View) {
      if (stopped.current) return
      if (v.stage !== stageStarted.current.stage) stageStarted.current = { stage: v.stage, at: Date.now() }
      setView(v)
      setNetError(false)
      if (v.status === 'done') {
        stopped.current = true
        router.replace(`/${locale}/done/${v.slug}`)
        return
      }
      if (v.status === 'waiting') void advance()
    }

    async function poll() {
      try {
        const res = await fetch(`/api/builds/${buildId}`, { cache: 'no-store' })
        if (!res.ok) throw new Error(String(res.status))
        apply((await res.json()) as View)
      } catch {
        if (!stopped.current) setNetError(true)
      }
    }

    void advance()
    void poll()
    const pollTimer = setInterval(() => void poll(), 2000)
    const clock = setInterval(() => {
      setElapsed(Math.round((Date.now() - started.current) / 1000))
      setStageElapsed((Date.now() - stageStarted.current.at) / 1000)
      setTick((n) => n + 1)
    }, 1000)
    return () => {
      stopped.current = true
      clearInterval(pollTimer)
      clearInterval(clock)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildId])

  async function resume() {
    setView((v) => (v ? { ...v, status: 'waiting', error: null } : v))
    const res = await fetch(`/api/builds/${buildId}/advance`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ retry: true }) })
    if (res.ok) setView((await res.json()) as View)
  }

  const stage = (view?.stage ?? 'extract') as Exclude<Stage, 'done'>
  const index = view?.stage === 'done' ? VISIBLE.length : VISIBLE.indexOf(stage)
  const failed = view?.status === 'failed'
  const running = view?.status === 'running' || view?.status === 'waiting'
  const stalled = Boolean(view && view.status === 'running' && view.runningFor !== null && view.runningFor >= view.staleAfter)
  const slow = Boolean(view && view.status === 'running' && view.runningFor !== null && view.runningFor >= 45 && !stalled)

  // Progress bar: completed stages plus an eased share of the current one, never reaching 100% early.
  const before = VISIBLE.slice(0, index).reduce((a, s) => a + EXPECTED[s], 0)
  const inStage = view?.stage === 'done' ? 0 : Math.min(EXPECTED[stage] * 0.92, stageElapsed)
  const percent = Math.min(99, Math.round(((before + inStage) / TOTAL) * 100))
  const details = (t[`detail_${stage}` as keyof Dictionary] as unknown as string[]) ?? []
  const detail = details.length ? details[Math.floor(tick / 3) % details.length] : ''
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')

  return (
    <div className="grid gap-5" data-testid="progress" data-stage={view?.stage ?? ''} data-status={view?.status ?? ''}>
      <div className="card p-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-3xl font-extrabold tabular-nums" aria-live="polite">{view?.stage === 'done' ? 100 : percent}%</span>
          <span className="text-sm text-ink-soft tabular-nums">{t.progressElapsed} {mm}:{ss}</span>
        </div>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-stone-100" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-full rounded-full transition-[width] duration-700 ease-out ${failed ? 'bg-danger' : 'bg-ink'}`} style={{ width: `${view?.stage === 'done' ? 100 : percent}%` }} />
        </div>
        {!failed ? <p className="mt-3 min-h-6 text-[15px] font-medium text-ink-soft" data-testid="detail">{view?.stage === 'done' ? t.progressDone : detail}</p> : null}
      </div>

      <ol className="card divide-y divide-line">
        {VISIBLE.map((s, i) => {
          const state = failed && i === index ? 'failed' : i < index ? 'done' : i === index && running ? 'active' : 'todo'
          return (
            <li key={s} className="flex items-center gap-4 px-5 py-4" data-testid={`stage-${s}`} data-state={state}>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${state === 'done' ? 'bg-ok text-white' : state === 'active' ? 'bg-ink text-white' : state === 'failed' ? 'bg-danger text-white' : 'bg-stone-100 text-stone-400'}`} aria-hidden="true">
                {state === 'done' ? '✓' : state === 'failed' ? '!' : i + 1}
              </span>
              <span className={`text-[17px] ${state === 'active' ? 'font-bold' : state === 'todo' ? 'text-stone-400' : 'font-semibold'}`}>{t[`stage_${s}` as keyof Dictionary] as string}</span>
              {state === 'active' ? <span className="ms-auto flex gap-1" aria-hidden="true"><i className="h-2 w-2 rounded-full bg-accent pulse-soft" /><i className="h-2 w-2 rounded-full bg-accent pulse-soft [animation-delay:0.2s]" /><i className="h-2 w-2 rounded-full bg-accent pulse-soft [animation-delay:0.4s]" /></span> : null}
            </li>
          )
        })}
      </ol>

      {slow ? <p className="rounded-2xl bg-accent-soft/60 p-4 text-sm font-medium text-accent-deep">{t.progressStillWorking}</p> : null}
      {stalled ? (
        <div className="card grid gap-3 p-5" data-testid="stalled">
          <p className="text-sm font-medium text-ink-soft">{t.progressStalled}</p>
          <button className="btn-primary" onClick={resume} data-testid="resume">{t.resume}</button>
        </div>
      ) : null}
      {failed ? (
        <div className="card grid gap-4 border-red-200 bg-red-50/60 p-5" role="alert" data-testid="build-failed">
          <p className="text-lg font-bold text-danger">{t.buildFailed}</p>
          <p className="text-sm text-ink-soft" dir="auto">{view?.error}</p>
          <div className="flex flex-wrap gap-2">
            {view?.retryable ? <button className="btn-secondary" onClick={resume} data-testid="retry">{t.retry}</button> : null}
            <Link className="btn-secondary" href={`/${locale}`}>{t.startOver}</Link>
          </div>
        </div>
      ) : null}
      {netError && !failed ? <p className="text-center text-sm text-ink-soft">{t.errorGeneric}</p> : null}
    </div>
  )
}
