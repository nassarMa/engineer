# Panniantong/agent-reach

- **Purpose:** Gives AI agents read/search access to the internet (web, GitHub,
  YouTube, Reddit, Twitter/X, Bilibili, XiaoHongShu, RSS, V2EX, LinkedIn, …).
- **Language / framework:** Python ≥3.10, argparse CLI, hatchling build. MIT.
- **Default branch:** main (studied at `94f06c1`, v1.5.0, 2026-10-08)
- **Last onboarded:** 2026-10-16 (static read only — its code was not executed here)

## What it actually is

Not a scraping library and not a wrapper. It is an **installer + health
checker + router** for upstream tools. After setup, the agent calls those
tools directly; the Python package never fetches content on the agent's behalf.

Three pieces:
1. `agent-reach install` — checks (default, read-only) or installs
   (`--system`) upstream CLIs: gh, yt-dlp, mcporter, Node, twitter-cli,
   rdt-cli, bili-cli, OpenCLI, etc.
2. `agent-reach doctor [--json]` — probes each channel and reports which
   backend is active.
3. `agent_reach/skill/SKILL.md` — the real product: a routing table that
   tells the agent which command to run per platform, with per-category
   references (`skill/references/*.md`, mostly in Chinese).

## Channels that matter for engineering work

| Need | Backend | Auth | Command |
|------|---------|------|---------|
| Web search | Exa remote MCP (`https://mcp.exa.ai/mcp`) | none | `web_search_exa`, `web_fetch_exa` |
| Read any URL as Markdown | Jina Reader | none | `curl -s https://r.jina.ai/<URL>` |
| GitHub repos/code/issues | gh CLI | optional | `gh search repos/code …` |
| Video tutorials / talks | yt-dlp | none | subtitles via `--write-auto-sub --skip-download` |
| Release feeds / blogs | feedparser | none | parse RSS/Atom |
| Dev community opinion | V2EX JSON API; Reddit/Twitter need cookies | varies | see `skill/references/social.md` |

Verified from this cloud container on 2026-10-16: Jina Reader (200, clean
Markdown), V2EX API (200), Exa MCP `tools/list` without any key (works).

## Architecture

- `agent_reach/cli.py` (2.4k lines) — all subcommands: install, configure,
  doctor, skill, format, transcribe, check-update, watch, uninstall.
- `agent_reach/channels/*.py` — one `Channel` per platform
  (`base.py`): `can_handle(url)`, `check(config)`, ordered `backends`
  list (`[0]` preferred, rest fallbacks), `active_backend` set by a real
  probe. Override per channel with config `<channel>_backend` / env.
- `agent_reach/doctor.py`, `probe.py` — runs channel checks.
- `agent_reach/integrations/mcp_server.py` — MCP server exposing only
  `get_status` (doctor report). No read/search tools via MCP.
- Config and tokens live in `~/.agent-reach/`; never in the workspace.

## Commands

| Task | Command |
|------|---------|
| Install | `pipx install https://github.com/Panniantong/agent-reach/archive/main.zip` |
| Check env (read-only) | `agent-reach install --env=auto` |
| Install tools (system changes) | `agent-reach install --env=auto --system [--channels=…]` |
| Health | `agent-reach doctor --json` |
| Dev install / test | `pip install -c constraints.txt -e .[dev]` · `pytest -q` |
| Lint / types | `ruff check .` · `mypy agent_reach` |

## Ideas worth borrowing

- **Ordered backends with fallback + real health probes**: when one access
  path breaks, reorder a list instead of rewriting code.
- **Skill as router**: a short SKILL.md with a routing table, detailed
  per-category references loaded only when needed.
- **Safe-by-default installer**: check-only unless `--system` is explicit.

## Gotchas and risks

- The `agent-reach` package **on PyPI is not this project**. Install only
  from the GitHub archive URL.
- Jina Reader and Exa are third-party services: every URL or query is sent
  to them. Never use them for private/internal URLs or secrets.
- Login-backed channels (Twitter, Reddit, XiaoHongShu, Facebook, Instagram,
  Xueqiu, Boss) need browser cookies or a logged-in Chrome session. Use a
  throwaway account; automated use can break platform terms and get the
  account banned. They don't fit a headless cloud container.
- Free endpoints (Jina, Exa without a key) are rate-limited.
- The README warns of crypto scams using the project's name; it has no token.
