import type { Db } from '../db'
import { failStage, finishStage, getBuild, getRestaurantById, lockBuild, LOCK_TTL_SECONDS, MAX_ATTEMPTS, updateRestaurant, type BuildRow } from '../db/repo'
import { nextStage, type Stage } from '../schemas'
import { AiError } from '../ai/types'
import { STAGE_RUNNERS, StageError } from './stages'

export type BuildView = {
  id: string
  stage: Stage
  status: BuildRow['status']
  attempt: number
  error: string | null
  retryable: boolean
  /** Seconds the current stage has been running, or null when idle. */
  runningFor: number | null
  /** After this many seconds a running stage is considered dead and can be resumed. */
  staleAfter: number
  slug: string
  publishedUrl: string | null
  verified: boolean
  log: BuildRow['log']
}

export async function viewBuild(db: Db, buildId: string): Promise<BuildView | null> {
  const build = await getBuild(db, buildId)
  if (!build) return null
  const restaurant = await getRestaurantById(db, build.restaurant_id)
  if (!restaurant) return null
  return {
    id: build.id,
    stage: build.stage,
    status: build.status,
    attempt: build.attempt,
    error: build.error,
    retryable: build.retryable && build.attempt < MAX_ATTEMPTS,
    runningFor: build.status === 'running' && build.locked_at ? Math.max(0, Math.round((Date.now() - new Date(build.locked_at).getTime()) / 1000)) : null,
    staleAfter: LOCK_TTL_SECONDS,
    slug: restaurant.slug,
    publishedUrl: restaurant.status === 'published' && restaurant.verified_at ? restaurant.published_url : null,
    verified: Boolean(restaurant.verified_at),
    log: build.log,
  }
}

/**
 * Run exactly one stage of a build. Safe to call repeatedly and concurrently:
 * the row lock makes concurrent callers no-ops, and a failed stage is only
 * re-run when `retry` is set.
 */
export async function advanceBuild(db: Db, buildId: string, opts: { retry?: boolean } = {}): Promise<BuildView | null> {
  const locked = await lockBuild(db, buildId, Boolean(opts.retry))
  if (!locked) return viewBuild(db, buildId)
  if (locked.stage === 'done') {
    await finishStage(db, locked, 'done', { stage: 'done', ms: 0 })
    return viewBuild(db, buildId)
  }
  const restaurant = await getRestaurantById(db, locked.restaurant_id)
  if (!restaurant) {
    await failStage(db, locked, 'Restaurant record is missing.', false)
    return viewBuild(db, buildId)
  }
  const started = Date.now()
  try {
    const note = await STAGE_RUNNERS[locked.stage]({ db, restaurant })
    const written = await finishStage(db, locked, nextStage(locked.stage), { stage: locked.stage, ms: Date.now() - started, note })
    if (!written) console.warn(`[build ${buildId}] ${locked.stage} finished after its lock was taken over; result discarded`)
  } catch (e) {
    const known = e instanceof StageError || e instanceof AiError
    const message = known ? e.message : `Unexpected error while running "${locked.stage}". Please try again.`
    console.error(`[build ${buildId}] ${locked.stage} failed:`, e)
    await failStage(db, locked, message, known ? e.retryable : true)
    if (locked.stage === 'publish') await updateRestaurant(db, restaurant.id, { status: 'failed' })
  }
  return viewBuild(db, buildId)
}

/** Drive a build to completion (tests and scripts). */
export async function runBuildToEnd(db: Db, buildId: string, maxSteps = 12): Promise<BuildView> {
  let view = (await viewBuild(db, buildId))!
  for (let i = 0; i < maxSteps && view.status !== 'done' && view.status !== 'failed'; i++) {
    view = (await advanceBuild(db, buildId))!
  }
  return view
}
