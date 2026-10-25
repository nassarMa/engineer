import { NextResponse } from 'next/server'
import { aiProviderName, setupProblems } from '@/lib/env'
import { getDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  let db = 'ok'
  try {
    await (await getDb()).query('SELECT 1')
  } catch (e) {
    db = `error: ${(e as Error).message}`
  }
  return NextResponse.json({ ok: db === 'ok', db, ai: aiProviderName(), setup: setupProblems() })
}
