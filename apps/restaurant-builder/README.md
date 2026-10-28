# AI Restaurant Website Builder

From a menu photo to a published restaurant website. A restaurant owner picks a
language, fills one form (name, menu photos/PDF, phone, address, optional logo,
description and photos), chooses the website language, taps **Build My
Website**, and receives a real URL. Builder UI in Arabic, English and Hebrew
(RTL/LTR handled); the published site language is chosen independently.

## How it works

```
form ─► POST /api/builds ─► builds.stage = extract
             client polls POST /api/builds/:id/advance, one stage per call:
  extract  Claude vision reads the menu → structured JSON (prices verbatim, confidence flags)
  brand    picks a theme preset, font pair and accent from a fixed design system
  design   picks hero/menu layouts, section order, which photos to use (it sees them)
  content  writes headline/about/labels and translates the menu (ids only; no prices)
  qa       code assembles the site config, checks it (prices == extraction, links,
           contrast, empty sections, RTL) and auto-repairs, then fetches the real page
  publish  marks the site live and verifies the public URL actually serves it
```

The AI never produces code. It produces configuration validated by zod
(`src/lib/schemas.ts`); `src/components/site/Site.tsx` renders it from a fixed
component library and theme system (`src/lib/render/themes.ts`). If the menu is
unreadable or too uncertain, the site shows the original menu images instead of
guessed prices. If nothing accurate can be shown, the build fails with a clear
message rather than publishing invented content.

Published sites live at `/r/<slug>`; with `PLATFORM_DOMAIN` set, `<slug>.<domain>`
serves the same page (see `src/proxy.ts`). Owners get a random edit key (hash
stored) to update name, phone, address and description later.

## Run locally

```bash
pnpm install
pnpm dev            # http://localhost:3000, mock AI, embedded Postgres + local files under .data/
```

Without `ANTHROPIC_API_KEY` the app runs the `mock` provider: deterministic
results chosen from the restaurant name (café / fish / grill). Add the key to use
Claude.

## Checks

```bash
pnpm check          # lint + typecheck + unit tests + production build
pnpm test:e2e       # Playwright, phone viewport, full journey in all three languages
TEST_DATABASE_URL=postgres://... pnpm test   # same unit suite on a real Postgres (the production driver)
```

## Going live (what the owner of the platform must configure)

The app refuses to pretend: on Vercel it returns a clear error until these exist.

| Variable | Required | What it is |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Claude API key (console.anthropic.com). Without it the mock provider runs. |
| `AI_MODEL` | no | Defaults to `claude-opus-5-5`. |
| `DATABASE_URL` | yes on Vercel | Postgres connection string (Neon, Supabase, Vercel Postgres). Tables are created on first use. |
| `BLOB_READ_WRITE_TOKEN` | yes on Vercel | Vercel Blob store token (Storage tab → Create Blob store → connect to project). |
| `APP_URL` | recommended | Public URL of the deployment, e.g. `https://builder.example.com`. Falls back to Vercel's production URL. |
| `PLATFORM_DOMAIN` | optional | e.g. `sites.example.com`. Add the domain **and** `*.sites.example.com` to the Vercel project and point both at Vercel (CNAME `cname.vercel-dns.com`). Sites become `https://<slug>.sites.example.com`. Without it, sites are `APP_URL/r/<slug>`. |
| `BUILD_RATE_LIMIT`, `UPLOAD_RATE_LIMIT`, `BUILD_DAILY_BUDGET` | no | Per-IP per hour (default 6 builds, 120 uploads) and a platform-wide daily build ceiling (default 200) that bounds AI spend. |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | previews only | Set when Vercel Deployment Protection is on, so the build can fetch its own preview pages for the render check. |
| `TRUST_PROXY` | self-hosting only | `1` when behind your own reverse proxy, so rate limits use the forwarded client address. Vercel is trusted automatically. |

Vercel setup: import the repository, set **Root Directory** to
`apps/restaurant-builder`, add the variables above, deploy. Function duration for
`/api/builds/[id]/advance` is set to 300 s in the route (Pro plan or Fluid
Compute needed for long menus).

Limits worth knowing: one upload per request, 4 MB each (images are downscaled
in the browser first); up to 8 menu files and 12 photos per restaurant; a failed
build can be retried 3 times. Logo extraction from the menu works for image
menus, not PDF pages. Mock mode (`AI_PROVIDER=mock`) is refused on Vercel unless
set explicitly, so a deployment without an API key fails clearly instead of
publishing placeholder content.

## Layout

```
src/app/(home)          language picker
src/app/[locale]        form, build progress, success, edit  (ar | en | he)
src/app/r/[slug]        published restaurant sites
src/app/api             uploads, builds, advance, restaurants (owner edit), files, health
src/lib/ai              provider interface, Claude provider, mock provider, prompts
src/lib/pipeline        stages, assembly, runner (row-locked, idempotent)
src/lib/qa.ts           deterministic quality gate + auto-repair
src/lib/render          theme presets, palettes, fonts per script
src/components/site     the site renderer
src/lib/db              Postgres / PGlite adapter, repository
tests/unit, tests/e2e   vitest + Playwright
```
