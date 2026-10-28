# nassarMa/bayt-digital-dashboard (restaurant builder)

The AI Restaurant Website Builder: upload a menu photo, get a published
restaurant website. It used to live in this repo at `apps/restaurant-builder`
and moved to its own repository, with its history, on 2026-10-28. The repo
reuses the old Bayt Digital dashboard repository and is due to be renamed;
GitHub redirects the old URL after a rename.

- Stack: Next.js 16, React 19, TypeScript, Tailwind 4, Postgres (PGlite
  locally), Vercel Blob, Anthropic SDK.
- Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`,
  `pnpm test:e2e`. CI is `.github/workflows/ci.yml`.
- Deploys: Vercel project `restaurant-builder`. Its Root Directory must be the
  repo root now, not `apps/restaurant-builder`.
- Design: `docs/designs/2026-10-25-restaurant-builder.md` in that repo (a copy
  stays here as the record).
- The Bayt Digital dashboard code that was there before is in that repo's
  history, before the "Replace the Bayt Digital dashboard" merge commit.
