import { NextResponse } from 'next/server'
import { aiProviderName, setupProblems } from '@/lib/env'
import { getDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  let dbOk = true
  try {
    await (await getDb()).query('SELECT 1')
  } catch (e) {
    dbOk = false
    console.error('health: database unreachable', e)
  }
  const setup = setupProblems()
  if (setup.length) console.warn('setup incomplete:', setup.join(' '))
  // Details stay in the server log; the public answer is just whether the service is usable.
  return NextResponse.json({ ok: dbOk && setup.length === 0, ai: aiProviderName() }, { status: dbOk ? 200 : 503 })
}
