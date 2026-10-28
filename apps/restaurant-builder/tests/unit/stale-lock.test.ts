import { afterAll, beforeAll, expect, it } from 'vitest'
import type { Db } from '@/lib/db'
import { lockBuild, getBuild } from '@/lib/db/repo'
import { setupEnv, start } from './helpers'

let db: Db
beforeAll(async () => {
  db = await setupEnv()
})
afterAll(async () => db.close())

it('takes over a dead lock and resumes a stuck running build', async () => {
  const { build } = await start(db, { name: 'Stuck Grill' })
  await db.query(`UPDATE builds SET status = 'running', locked_at = now() - interval '20 minutes', lock_token = 'dead' WHERE id = $1`, [build.id])
  const got = await lockBuild(db, build.id, true)
  expect(got?.attempt).toBe(2)
  const again = await getBuild(db, build.id)
  expect(again?.lock_token).not.toBe('dead')
})
