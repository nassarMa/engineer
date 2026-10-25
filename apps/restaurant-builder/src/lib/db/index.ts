import { dataDir } from '../env'

/**
 * One tiny query interface over two backends:
 *  - Postgres (DATABASE_URL) for real deployments
 *  - PGlite, an embedded Postgres, for local development and tests
 * Both take $1-style placeholders and return plain row arrays.
 */
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>
  close(): Promise<void>
}

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS uploads (
     id TEXT PRIMARY KEY,
     kind TEXT NOT NULL,
     mime TEXT NOT NULL,
     bytes INTEGER NOT NULL,
     width INTEGER,
     height INTEGER,
     storage_key TEXT NOT NULL,
     url TEXT NOT NULL,
     ip TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS restaurants (
     id TEXT PRIMARY KEY,
     slug TEXT UNIQUE NOT NULL,
     name TEXT NOT NULL,
     phone TEXT NOT NULL,
     address TEXT NOT NULL,
     description TEXT NOT NULL DEFAULT '',
     website_lang TEXT NOT NULL,
     builder_locale TEXT NOT NULL,
     logo_mode TEXT NOT NULL DEFAULT 'none',
     logo_upload_id TEXT,
     menu_upload_ids JSONB NOT NULL DEFAULT '[]',
     photo_upload_ids JSONB NOT NULL DEFAULT '[]',
     owner_key_hash TEXT NOT NULL,
     preview_token TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'draft',
     extracted_menu JSONB,
     brand JSONB,
     design JSONB,
     content JSONB,
     site_config JSONB,
     qa_report JSONB,
     published_url TEXT,
     published_at TIMESTAMPTZ,
     verified_at TIMESTAMPTZ,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS builds (
     id TEXT PRIMARY KEY,
     restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
     stage TEXT NOT NULL DEFAULT 'extract',
     status TEXT NOT NULL DEFAULT 'waiting',
     attempt INTEGER NOT NULL DEFAULT 1,
     error TEXT,
     log JSONB NOT NULL DEFAULT '[]',
     retryable BOOLEAN NOT NULL DEFAULT true,
     locked_at TIMESTAMPTZ,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  // Additive changes for databases created by earlier versions.
  `ALTER TABLE builds ADD COLUMN IF NOT EXISTS retryable BOOLEAN NOT NULL DEFAULT true`,
  `CREATE TABLE IF NOT EXISTS rate_limits (
     key TEXT PRIMARY KEY,
     window_start TIMESTAMPTZ NOT NULL,
     count INTEGER NOT NULL DEFAULT 0
   )`,
]

async function migrate(db: Db, serialize: boolean): Promise<void> {
  // Concurrent cold starts must not race on CREATE TABLE; Postgres gets an advisory lock.
  if (serialize) await db.query('SELECT pg_advisory_lock(7418291)')
  try {
    for (const sql of MIGRATIONS) await db.query(sql)
  } finally {
    if (serialize) await db.query('SELECT pg_advisory_unlock(7418291)')
  }
}

async function openPostgres(url: string): Promise<Db> {
  const { default: postgres } = await import('postgres')
  const sql = postgres(url, { max: 5, prepare: false, idle_timeout: 20 })
  const db: Db = {
    async query<T>(text: string, params: unknown[] = []) {
      return (await sql.unsafe(text, params as never[])) as unknown as T[]
    },
    async close() {
      await sql.end()
    },
  }
  await migrate(db, true)
  return db
}

async function openPglite(dir: string | undefined): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite')
  if (dir) {
    const fs = await import('node:fs')
    fs.mkdirSync(dir, { recursive: true })
  }
  const pg = dir ? new PGlite(dir) : new PGlite()
  const db: Db = {
    async query<T>(text: string, params: unknown[] = []) {
      const res = await pg.query<T>(text, params)
      return res.rows
    },
    async close() {
      await pg.close()
    },
  }
  await migrate(db, false)
  return db
}

/** Opens a fresh, isolated in-memory database (tests). */
export async function openTestDb(): Promise<Db> {
  return openPglite(undefined)
}

declare global {
  var __rbDb: Promise<Db> | undefined
}

/** The process-wide database, created on first use. */
export function getDb(): Promise<Db> {
  if (!globalThis.__rbDb) {
    const url = process.env.DATABASE_URL
    globalThis.__rbDb = url ? openPostgres(url) : openPglite(`${dataDir()}/pglite`)
    globalThis.__rbDb.catch(() => {
      globalThis.__rbDb = undefined
    })
  }
  return globalThis.__rbDb
}

/** Test hook: route getDb() to a specific instance. */
export function setDb(db: Db | undefined): void {
  globalThis.__rbDb = db ? Promise.resolve(db) : undefined
}
