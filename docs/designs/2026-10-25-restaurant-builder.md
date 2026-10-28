# AI Restaurant Website Builder

Status: Implemented. Moved to its own repo, nassarMa/bayt-digital-dashboard (to be renamed). Needs credentials to go live; see
"Going live" below.

## Problem

Restaurant owners want a website but have no design or coding skills. The
product takes a menu photo plus a few facts, and returns a published, mobile-first
restaurant website with a real URL. Builder UI in Arabic, English or Hebrew;
the published site language is chosen separately.

## Decisions

- **One Next.js 16 app, multi-tenant.** The builder and every published site run
  in the same deployment. A site is a row in Postgres (`restaurants.site_config`),
  rendered at `/r/<slug>`; with `PLATFORM_DOMAIN` set, `<slug>.<domain>` is
  rewritten to the same route by `src/proxy.ts`. Nothing is generated as
  executable code: the AI produces *configuration* validated by zod, and a
  fixed component library renders it.
- **Pipeline as a state machine, one stage per request.** `builds.stage`
  walks `extract → brand → design → content → qa → publish → done`. The client
  polls `GET /api/builds/:id` and calls `POST /api/builds/:id/advance`; each
  call runs one stage under a row lock, so Vercel function limits are never
  hit, a crashed stage is retried from where it stopped, and retries never
  create a second site (the slug is reserved when the build is created).
- **Five AI roles, one orchestrator.** Menu intelligence (vision, structured
  output), brand identity, design director, content & localization, each a
  separate structured-output call in `src/lib/ai/anthropic.ts`. QA and
  publishing are deterministic code. A `mock` provider gives deterministic
  results for tests and for local work without a key.
- **Prices are never touched by the model after extraction.** Extraction keeps
  the price string verbatim; the content stage only returns translated names
  and descriptions keyed by item id; code merges, and QA fails the build if any
  price in the final config differs from the extracted one. Low-confidence
  extraction falls back to showing the original menu images.
- **Storage/DB adapters.** Postgres via `DATABASE_URL`, else an embedded PGlite
  database under `.data/` (local only). Files go to Vercel Blob via
  `BLOB_READ_WRITE_TOKEN`, else the local filesystem. On Vercel both are
  required; the app refuses to build sites otherwise and says why.
- **Ownership.** Each restaurant gets a random owner key (hash stored). It is
  shown once on the success screen, kept in the browser, and required to edit.
- **Uploads.** One file per request (Vercel body limit), images downscaled in
  the browser before upload, validated by magic bytes on the server, re-encoded
  with sharp.

## Going live

Environment variables: `ANTHROPIC_API_KEY`, `DATABASE_URL`,
`BLOB_READ_WRITE_TOKEN`, `APP_URL`, optional `PLATFORM_DOMAIN` (wildcard DNS
`*.domain` pointed at Vercel and added to the project). See the app README.
