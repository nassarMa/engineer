# Five Claude Code add-ons from a reel: what we adopted and why

Status: Implemented (scripts/watch-video.sh, claude-automation-recommender,
skill-retro, scripts/headroom-claude.sh). Evaluated 2026-11-04.

## Problem

The user shared an Instagram reel (ahmad.abu.rabee3, 2026-11-03, Arabic)
pitching five add-ons that fix "Claude Code runs out of tokens and forgets
everything between sessions". The question: which belong in this engineer,
and how, given that it runs mostly in ephemeral cloud containers and must
never send private code to third parties.

How the reel was read: caption, a local Whisper transcript and frames
(GitHub screenshots gave the repo names). That pipeline is now
`scripts/watch-video.sh`.

## Verdicts

| Add-on | Reel's pitch | What it really is | Verdict |
|--------|--------------|-------------------|---------|
| OmniRoute (`cheaper-inference/OmniRoute`, MIT, npm `omniroute` 3.8.52) | 200+ free providers; auto-switch when the Claude limit hits; 1.5B free tokens a month | Local gateway (`ANTHROPIC_BASE_URL=localhost:20128`) that forwards prompts and code to whichever provider has quota | **Rejected** |
| Claude-Mem (`thedotmack/claude-mem`, Apache-2.0, v15.9.0) | Memory between sessions | Hooks on every tool call feed a local Bun worker; Haiku summarises into SQLite + Chroma in `~/.claude-mem`; injects recent observations at session start | **Rejected for this repo** (personal desktop use only, hardened) |
| Headroom (`headroomlabs-ai/headroom`, Apache-2.0, PyPI `headroom-ai` 0.42.0) | Same answers, fewer tokens | Local proxy on `127.0.0.1:8787` that compresses the newest tool output, logs and JSON, keeps earlier prompt bytes identical for caching, and still talks to Anthropic with Claude Code's own credentials | **Opt-in, desktop only**: `scripts/headroom-claude.sh` |
| Claude Code Setup (`anthropics/claude-plugins-official`, Apache-2.0, v1.0.0) | Scans the project and recommends hooks, skills, subagents, MCP servers | One read-only skill, `claude-automation-recommender`, with reference catalogs | **Adopted**: vendored, used by `onboard-repo` |
| Task Observer (`rebelytics/one-skill-to-rule-them-all`, CC-BY-4.0, v3.9.0) | Watches how you work and keeps improving your skills | A ~12k-token prompt-only skill that logs observations outside the repo and stages proposed skill copies for a human | **Idea adopted, rebuilt** as `skill-retro` |

## Reasons

**OmniRoute.** Its Claude subscription path spoofs Claude Code (fake
billing header, client-identifying text stripped, TLS fingerprint
impersonation) to get around Anthropic's limits on third-party use of
subscription OAuth, which Anthropic's terms forbid and have enforced since
February 2026: a ban risk for the account. Its free tiers send source code
to providers, some of which log every request; that breaks our rule against
sending code to third parties. It had a critical unauthenticated RCE
(CVE-2026-88062) and auth bypasses fixed only in 3.8.52, and it binds to
`0.0.0.0` by default. The "1.5B free tokens" is the README's own estimate
summed over free tiers you sign up for one by one, not a grant.

**Claude-Mem.** It works on a persistent desktop, but here it would capture
raw tool output, secrets included, with redaction off by default and
PostHog telemetry on. Open issues report the npx installer uploading 30 days
of prompts to cmem.ai (#5176), any local process reading all memories
(#5141), and privacy docs that contradict the defaults (#4605). Its store
dies with a cloud container, and its cloud answer streams tool use to a paid
third-party service. Every tool call also costs a Haiku call. What we
already have does the job reviewably and survives containers: CLAUDE.md,
`docs/repos/` knowledge files, `docs/designs/`, and now
`docs/skill-observations/`. Desktop users who want it anyway: install via
`/plugin`, not npx; set `DO_NOT_TRACK=1`, `CLAUDE_MEM_REDACT_ENABLED=true`,
`CLAUDE_MEM_REDACT_GENERIC_ENABLED=true`; leave cloud sync off; never enable
it in this repo's settings.

**Headroom.** Compression is local and the upstream is still Anthropic, so
no code reaches a third party. Vendor benchmarks show 21–57% savings on
agent sessions and 90%+ on repetitive JSON and logs, little on prose. Why
not default: a cloud session's Claude Code can't be pointed at a proxy, the
MCP-only mode saves little, and it downloads models at first run. On a
desktop it rewrites what is sent, so an API key is the cleaner fit; with a
subscription it disables Remote Control. The wrapper turns its usage beacon
off and stops it from registering the Serena MCP server. Its hooks plugin,
which auto-starts a background service, is deliberately not installed.

**Claude Code Setup.** Official, read-only, small, and fills a gap:
`onboard-repo` learned a repo but never asked which automations it should
have. Cloud sessions don't install plugins enabled in project settings, so
it is vendored unmodified by `scripts/sync-official-plugin-skills.sh` (pinned
`fa4eb54`). Our rules for it live in `onboard-repo`: run it against the
target repo, filter out what this engineer already provides, keep repo code
out of its web searches, record suggestions, apply nothing unasked. Known
upstream nits: `claude mcp add context7` lacks the URL and `--mcp-debug` is
outdated.

**Task Observer.** The idea is right; the package fits poorly. It loads
~12k tokens every session, needs a CLAUDE.md line or hook to trigger at
all, keeps its log at a stable path cloud containers don't have, and is
tuned for the desktop app. `skill-retro` keeps the core loop in under 100
lines: log paraphrased observations as committed files, apply them later as
a diff on a branch, never edit vendored skills in place, and grep for
secrets before committing. The reel's "keeps improving automatically" isn't
what either does, by design: changes go through review.

## Not adopted from the same research, worth a look later

From Anthropic's official marketplace: `claude-md-management` (audits
CLAUDE.md, `/revise-claude-md`), `plugin-dev` (writing hooks, agents,
plugins), the LSP plugins, and `context7` (hosted library-docs MCP, no key).
