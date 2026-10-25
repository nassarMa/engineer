import type { Db } from '../db'
import { failStage, finishStage, getBuild, getRestaurantById, lockBuild, updateRestaurant, type BuildRow } from '../db/repo'
import { nextStage, type Stage } from '../schemas'
import { AiError } from '../ai/types'
import { STAGE_RUNNERS, StageError } from './stages'

export type BuildView = {
  id: string
  stage: Stage
  status: BuildRow['status']
  attempt: number
  error: string | null
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
    await finishStage(db, buildId, 'done', { stage: 'done', ms: 0 })
    return viewBuild(db, buildId)
  }
  const restaurant = await getRestaurantById(db, locked.restaurant_id)
  if (!restaurant) {
    await failStage(db, buildId, 'Restaurant record is missing.')
    return viewBuild(db, buildId)
  }
  const started = Date.now()
  try {
    const note = await STAGE_RUNNERS[locked.stage]({ db, restaurant })
    await finishStage(db, buildId, nextStage(locked.stage), { stage: locked.stage, ms: Date.now() - started, note })
  } catch (e) {
    const message = e instanceof StageError || e instanceof AiError ? e.message : `Unexpected error in ${locked.stage}: ${(e as Error).message}`
    console.error(`[build ${buildId}] ${locked.stage} failed:`, e)
    await failStage(db, buildId, message)
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
