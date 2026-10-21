# Project Hub — a mobile-first home screen for all my AI experiments

- **Status:** Implemented (v1 on branch `claude/project-hub` of nassarMa/mahmood-nassar)
- **Date:** 2026-10-21
- **Target repo(s):** nassarMa/mahmood-nassar (existing repo, rebuilt from scratch), deployed on Vercel

## Problem
Projects (apps, games, tools, experiments) live at scattered URLs. Social
bios allow one link. Followers who see one project in a Reel never find
the rest; the live app, its demo clip and its backstory are split across
platforms; a plain list of links gives no reason to explore or return.

## Goals / Non-goals
**Goals**
- One URL for the bio. Opens fast on a phone, works with one thumb.
- Every project discoverable in two taps: see it, understand it, launch it.
- Each project carries its demo clip, a short story, tags and the launch link.
- Adding a project is a commit; no CMS, no accounts.
- Feels like an app, not a list: a familiar "home screen" of icons.

**Non-goals (v1)**
- Visitor accounts, comments, likes.
- Hosting the projects themselves (they stay where they are; the hub links out or embeds).
- Admin UI, notifications/email list (candidates for v2).

## Constraints and assumptions
- Mobile first; desktop is a centered phone-width layout.
- Static where possible; the only dynamic parts are OG images and (later) analytics.
- Media (cover images, demo clips) is committed to the repo under a size budget
  (cover ≤ 300 KB, clip ≤ 3 MB, ≤ 10 s, muted, looping). Larger media → external URL.
- Assumption: ~10–50 projects over time. Assumption: the user's handle/brand
  name and 2–3 real projects will be supplied; the build starts with samples.

## Options considered
Decided with the user on 2026-10-21:
- **Experience:** phone home screen (vs arcade picker, feed with live previews, explorable map).
- **Stack:** Next.js + Tailwind (vs Astro, Vite SPA).
- **Content:** files in the repo (vs headless CMS, in-app admin).
- **Repo:** new repository (vs subfolder of engineer).

## Detailed design

### Experience
- `/` — the **home screen**: a grid of app icons (4 columns on phones), each
  with the project's icon and name, "NEW" dot for projects < 14 days old.
  Projects can be grouped into **folders** by tag (Games, Tools, Experiments);
  a folder opens as an overlay grid, like iOS. A thin top bar shows the
  creator's avatar, handle and social links. A dock at the bottom pins up to
  4 featured projects. Horizontal pages if the grid overflows (swipe).
- Tap an icon → **project sheet** slides up from the bottom (route
  `/p/[slug]`, so it is linkable and shareable from a Reel): cover or
  autoplaying muted demo clip, title, tagline, tags, **Launch** button
  (opens the live app in a new tab), "Watch the Reel" link if present, and
  the story in markdown (what it is, how it was built, what was learned).
  Swipe down or back closes it and returns to the grid with scroll preserved.
- **Search** (pull down on the grid, like iOS Spotlight): filters by name/tag.
- **Install**: a web app manifest so the hub itself can be added to a phone's
  home screen; standalone display mode.
- Share: every `/p/[slug]` has an OG image generated from the project's
  cover/icon + title, so links posted in stories unfurl nicely.

### Data model (files in the repo)
```
content/
  creator.json          # name, handle, avatar, bio line, social links, dock (featured slugs)
  projects/<slug>/
    project.json        # see schema
    story.md            # markdown; optional
    icon.png            # 512×512, required
    cover.jpg           # 1200×630-ish, optional (falls back to icon)
    demo.mp4            # optional short clip
```
`project.json` schema (validated with zod at build time; a bad file fails the build):
```ts
{
  title: string; tagline: string;            // ≤ 60 / ≤ 120 chars
  url: string;                               // live app
  kind: "app" | "game" | "tool" | "experiment";
  tags: string[]; folder?: string;           // folder groups icons
  date: "YYYY-MM-DD";                        // release date → NEW badge, sort
  status?: "live" | "beta" | "archived";
  links?: { reel?: string; source?: string; }
  media?: { cover?: string; demo?: string; } // relative file or https URL
  featured?: boolean;
}
```
Loader: `lib/content.ts` reads `content/` at build time (`fs` in server
components), validates, sorts by date, derives folders. No runtime FS reads.

### Components and responsibilities
- `app/page.tsx` — home screen (server component) → `HomeScreen` client
  component for gestures/pages.
- `app/p/[slug]/page.tsx` — project sheet; rendered as an intercepting
  route over the grid when navigated client-side, full page on direct load.
- `app/p/[slug]/opengraph-image.tsx` — OG image via `next/og`.
- `app/manifest.ts`, `app/sitemap.ts`.
- `components/`: `AppIcon`, `Folder`, `Dock`, `ProjectSheet`, `MediaPreview`,
  `Search`, `TopBar`.
- `lib/content.ts` (loader + zod schema), `lib/dates.ts`.

### Stack
Next.js 16 (App Router, TypeScript), Tailwind CSS v4, `zod`, `framer-motion`
(sheet and folder transitions), `next/og`, `gray-matter`/`remark` for story
markdown. Tests: Vitest for the loader/schema, Playwright for the three
core flows (open project, open folder, search). ESLint + Prettier.

### Error handling and failure modes
- Invalid or missing project files fail `next build` with the file and field named.
- Missing cover → icon; missing demo → cover; missing story → sheet without story.
- External launch URLs open in a new tab with `rel="noopener"`.
- Video autoplay failures fall back to the cover (poster).

### Security
- No user input is stored; search is client-side only.
- Markdown rendered via remark with raw HTML disabled.
- No secrets in the repo; Vercel token stays in the engineer environment.

### Observability
- Vercel Analytics (page views per project) in v1 if the account allows; otherwise none.

## Testing strategy
- Unit: schema validation (good/bad fixtures), sorting, NEW-badge logic, folder derivation.
- E2E (Playwright, mobile viewport): home renders all sample projects; tap →
  sheet shows title + Launch link with correct href; folder opens; search filters;
  direct load of `/p/<slug>` works.
- Build check: `next build` passes with sample content; Lighthouse mobile
  performance ≥ 90 on the home screen.

## Rollout and rollback
- Vercel preview deployment from the branch for review; production on the
  user's say-so. Rollback = `vercel rollback`.

## Implementation plan
1. Scaffold Next.js + Tailwind + TS in the new repo; CI (lint, test, build).
2. Content loader + zod schema + unit tests; 4 sample projects with placeholder media.
3. Home screen grid, top bar, dock, NEW badge (static, no gestures).
4. Project sheet route + intercepting route + media preview + markdown story.
5. Folders and horizontal pages.
6. Search, manifest/PWA, OG images, sitemap.
7. Playwright e2e for the core flows; Lighthouse pass.
8. Preview deploy to Vercel; replace samples with real projects.

## Decisions made during the build
- Media lives in `public/projects/<slug>/` (served statically) rather than
  beside `project.json`; the loader verifies each referenced file exists.
- OG images use a bundled IBM Plex Sans Arabic WOFF: Satori cannot parse the
  Noto Arabic faces (GSUB lookupType 5 / substFormat 3) and has no bidi, so
  RTL titles get their word order reversed before rendering.
- Playwright uses the container's preinstalled Chromium when present.
- Visual tone: dark, glassy. Seeded with two real projects.

## Open items
- Vercel preview deploy once `VERCEL_TOKEN` is provided.
- Demo clips and Reel links for the two projects.
- Lighthouse pass not yet run.
