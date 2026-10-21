---
name: deploy-vercel
description: Deploy a web app or site to Vercel with the team's account, inspect deployments, read build logs, manage env vars, promote or roll back. Use when asked to deploy, ship a preview, publish to production, or debug a Vercel build.
---

# Deploy to Vercel

All commands go through `scripts/vercel.sh`, which adds the account token
from `VERCEL_TOKEN`. If it reports the token is missing, stop and tell the
user to add the `VERCEL_TOKEN` environment secret; never ask them to paste
a token into chat, and never run `vercel login`.

## Rules

1. **Preview by default.** Every deploy is a preview deployment unless the
   user explicitly asked for production. Production (`--prod`) only on an
   explicit "deploy to production / go live / release" and only from a
   branch whose checks pass.
2. **Deploy what's committed.** Run the app's own build and tests first.
   Don't deploy a dirty tree you haven't verified.
3. **Verify after deploying.** Fetch the returned URL (curl, or the
   `playwright` browser for a UI check) and report status + URL. A deploy
   isn't done until the page answers.
4. **Secrets stay in Vercel.** Set runtime config with `env add`, never
   by committing values. Don't print env values or the token in output.
5. **Rollback is one command away.** If production is broken after a
   deploy, `rollback` first, then diagnose.

## Commands

```bash
# Which account / team the token belongs to
scripts/vercel.sh whoami
scripts/vercel.sh teams ls

# Link a directory to a Vercel project (creates .vercel/, git-ignored).
# Alternative: set VERCEL_ORG_ID and VERCEL_PROJECT_ID instead of linking.
scripts/vercel.sh link --cwd path/to/app

# Preview deployment (prints the preview URL)
scripts/vercel.sh deploy --cwd path/to/app

# Production deployment (only on explicit request)
scripts/vercel.sh deploy --cwd path/to/app --prod

# Deployments, logs, inspection
scripts/vercel.sh ls --cwd path/to/app
scripts/vercel.sh inspect <deployment-url> --logs
scripts/vercel.sh logs <deployment-url>

# Promote a verified preview to production instead of rebuilding
scripts/vercel.sh promote <deployment-url>

# Roll production back to the previous deployment
scripts/vercel.sh rollback --cwd path/to/app

# Environment variables (values prompted/piped, never committed)
scripts/vercel.sh env ls --cwd path/to/app
echo -n "$VALUE" | scripts/vercel.sh env add NAME production --cwd path/to/app
scripts/vercel.sh env pull .env.local --cwd path/to/app   # local dev only; .env.local is git-ignored

# Build locally the way Vercel will, to catch build errors before deploying
scripts/vercel.sh build --cwd path/to/app
```

## Project config

Framework detection is automatic for Next.js, Vite, SvelteKit, Astro,
Remix, Nuxt, static sites, etc. Add a `vercel.json` only for things the
defaults don't cover (rewrites, headers, cron, regions, functions config).
Monorepo: deploy with `--cwd <package dir>` and set the Root Directory in
the project settings, or link each package to its own project.

## When a build fails

1. `inspect <url> --logs` for the real error; read the first error, not
   the last line.
2. Reproduce locally with `scripts/vercel.sh build --cwd ...` (same
   builder). Fix, re-run the app's tests, redeploy a preview.
3. Common causes: missing env var (add it with `env add`), Node version
   (`engines.node` in package.json), a dev-only dependency needed at build.

## Inspect-only alternative

The claude.ai **Vercel connector** (Settings → Connectors) gives read
tools in chat (`list_projects`, `list_deployments`, `get_deployment`,
`get_deployment_events`, `search_vercel_documentation`) without a token.
It cannot deploy; deploys always go through the CLI above.
