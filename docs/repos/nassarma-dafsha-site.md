# nassarMa/dafsha-site

- **Purpose:** Dafsha (دفشة) community website: Arabic-first homepage, a moderated public jobs board, and
  Market Pulse (نبض السوق), a job-market feed built from employers' public job boards and reviewed news.
- **Language / framework:** TypeScript, Next.js 16 App Router, React 19, Tailwind 4 + shadcn/ui (RTL), Drizzle ORM
  on Neon Postgres, Better Auth, Vitest, Playwright. Deployed on Vercel (project `dafsha`, Hobby plan).
- **Default branch:** `main`
- **Last onboarded:** 2026-11-10

## Commands
| Task | Command | Notes |
|------|---------|-------|
| Install | `pnpm install --frozen-lockfile` | pnpm 11 |
| Build | `pnpm build` | Do not run while `pnpm dev` is up: both write `.next` |
| Lint | `pnpm lint` | |
| Typecheck | `pnpm typecheck` | A stale `.next/dev/types` breaks it after moving a route; `rm -rf .next` |
| Test | `pnpm test` | Unit only, no database |
| Integration | `TEST_DATABASE_URL=…/dafsha_test pnpm test:integration` | Real Postgres; refuses any database not named `*_test`; not part of `pnpm ci` |
| E2E | `set -a; . ./.env.local; set +a; pnpm test:e2e` | Needs seeded dev DB and `e2e-admin@dafsha.test` in `ADMIN_EMAILS` |
| Everything | `pnpm ci` | typecheck + lint + unit + build |
| Run locally | `pnpm db:migrate && pnpm db:seed && pnpm dev` | `.env.local` with `DATABASE_URL`, `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL`, `REPORT_IP_SALT`, `E2E_OTP_FILE` |
| Market scan | `pnpm market:scan [jobs] [news] [analyze]` | Real network requests to ~150 job boards and 6 feeds, about 20 s |

Local Postgres in a cloud session: `service postgresql start`, then create a `dafsha` role and the
`dafsha_dev` and `dafsha_test` databases.

## Architecture
- `src/app` routes; `src/lib/{auth,db,jobs,admin,reports,market}` domain code; `src/components` UI.
- Mutations are Server Actions that start with `requireUser()` / `requireAdmin()` (`src/lib/auth/session.ts`).
- Market Pulse (`src/lib/market`): provider adapters (Greenhouse, Lever, Ashby, SmartRecruiters, Comeet) →
  daily snapshot per company → diff → one card per company; RSS → fixed-rule prefilter → AI analysis behind
  `AiProvider` → deterministic verification → editor review. Scheduled by two daily Vercel crons hitting
  `/api/cron/market/{jobs,news}` with `Authorization: Bearer $CRON_SECRET`.
- Design docs live in the repo under `docs/superpowers/specs/`.

## Conventions
- The repo's `CLAUDE.md` holds hard rules: Arabic-first RTL with logical CSS properties, colours only from the
  named utilities in `globals.css`, no invented data, `[TEST]` seed data only.
- `AGENTS.md`: this Next.js version differs from older ones; read `node_modules/next/dist/docs/` before using an API.
- Commits: imperative subject, body explains why. No CI workflow in the repo; `pnpm ci` is the gate.
- Migrations are generated (`pnpm db:generate`) and applied by hand (`pnpm db:migrate`); Vercel does not run them.

## Gotchas
- A layout's auth check is not enough in this Next.js version: a request can ask for the page segment alone and
  skip the layout. Every page under `/admin` must call `requireAdmin()` itself (a unit test enforces it).
- `zodOutputFormat` from the Anthropic SDK moves `enum`s into field descriptions, so the API does not enforce
  them, and `messages.parse()` throws on one invalid item. Send a JSON schema built with `z.toJSONSchema` (minus
  the numeric and length keywords the API rejects) through `messages.create`, and validate items one by one.
- Inside a raw `sql` subquery Drizzle renders both columns unqualified; write the outer column out by hand
  (`"market_events"."id"`).
- Production, Preview and Development on Vercel share one Neon `DATABASE_URL`. A preview deployment reads the
  production database, so a migration applied "for a preview" is applied to production.
- Vercel has no `RESEND_API_KEY` and Google sign-in is configured for Production and Development only, so nobody
  can sign in on a preview deployment.
- The repo pins a newer `@playwright/test` than the browser pre-installed in cloud sessions. Run e2e with a local,
  uncommitted config that sets `launchOptions.executablePath` to `/opt/pw-browsers/chromium`.
- Email sign-in is rate-limited to 3 codes a minute per IP; repeated e2e runs in one minute fail at login.
- `tests/e2e/public.spec.ts` "job detail …" fails on `main`: two `link[rel=canonical]` elements after a
  client-side navigation from `/jobs`.
- Mixed Arabic and Latin headlines: do not wrap them in `<bdi dir="auto">`; a leading Latin company name flips the
  whole line to left-to-right.
- Several Israeli publishers restrict feed reuse (Geektime forbids passing content to AI systems, Globes requires
  written consent, TheMarker bans bots). Check terms before enabling a feed.
