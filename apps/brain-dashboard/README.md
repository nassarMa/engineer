# Brain dashboard

A small Next.js site that reads the engineer repository live from GitHub and
shows what the brain contains, how a project moves through it, which tools and
MCP servers it declares, the links between its pieces, and what needs a
maintainer's attention.

## How it reads the repo

- The whole branch comes down as one tarball from `codeload.github.com` and is
  parsed in memory. That download is not subject to the GitHub API rate limit,
  so no token is needed for a public repo.
- Recent commits come from the branch's public Atom feed.
- Branch comparison (ahead/behind) needs the GitHub API. Without `GITHUB_TOKEN`
  the anonymous limit (60 requests an hour per address) is usually spent, and
  the page says so instead of failing.
- Every page revalidates every 5 minutes (`REVALIDATE_SECONDS`).

## Environment variables (all optional)

| Name | Default | Purpose |
|------|---------|---------|
| `BRAIN_REPO` | `nassarMa/engineer` | Repository to read |
| `BRAIN_BRANCH` | `claude/trusting-hopper-x4ljjn` | Branch used when the API cannot tell the default branch |
| `GITHUB_TOKEN` | – | Enables branch comparison; read access to the repo is enough |

## Commands

```bash
pnpm install
pnpm dev          # http://localhost:3100
pnpm run ci       # typecheck + lint + unit tests + build
```

Deployed with `scripts/vercel.sh deploy --cwd apps/brain-dashboard` from the
repo root (Vercel project `engineer-brain`).
