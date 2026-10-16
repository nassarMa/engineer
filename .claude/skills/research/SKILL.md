---
name: research
description: Look something up on the internet — docs, errors, comparisons, repos, issues, videos, feeds, discussions. Use when a task needs knowledge not in the codebase. Routes to the best free tool per source with fallbacks (adapted from Panniantong/agent-reach).
---

# Research

Routing table. Try the first tool; on failure, move down the chain.

| Need | Tool chain | Reference |
|------|-----------|-----------|
| Web search | Exa MCP `web_search_exa` → `WebSearch` | [search](references/search.md) |
| Read a URL as Markdown | Jina Reader (`curl -s https://r.jina.ai/URL`) → Exa `web_fetch_exa` → `WebFetch` | [web](references/web.md) |
| GitHub repos / code / issues / PRs | GitHub MCP tools → `gh` CLI (public, no auth) | [dev](references/dev.md) |
| Video tutorial / talk transcript | `yt-dlp` subtitles | [video](references/video.md) |
| Blog / release feed | `feedparser` or `curl` + parse | [web](references/web.md) |
| Developer community opinion | V2EX API (zero config); Reddit/Twitter/HN via Exa search | [social](references/social.md) |

## Rules

- **Announce** which tool you're using the first time ("searching with Exa").
- **Fallback, don't retry forever**: one retry per tool, then the next in
  the chain, then say what failed.
- **Privacy**: Jina, Exa and WebSearch are external services. Never send
  internal URLs, source code, secrets, or customer data. If the thing to
  research is private, read it locally instead.
- **Rate limits**: free endpoints throttle. Batch queries; don't hammer.
- **Cite**: every fact in the output carries its source URL and, where
  relevant, the date or version.
- **Scratch files** go in the scratchpad directory, never the repo.

## Quick commands

```bash
# Read any page as clean Markdown
curl -s "https://r.jina.ai/https://example.com/docs"

# GitHub (public repos need no auth)
gh search repos "query" --sort stars --limit 10
gh search code "query" --language python --limit 10
gh repo view owner/repo
gh issue list -R owner/repo --search "keyword" --state all --limit 10

# YouTube transcript (auto-captions) to scratchpad
yt-dlp --write-auto-sub --sub-lang en --skip-download -o "$SCRATCH/%(id)s" "URL"

# V2EX hot topics (dev community, zero config)
curl -s "https://www.v2ex.com/api/topics/hot.json" -H "User-Agent: engineer-agent/1.0"
```

## Full Agent Reach (optional, desktop only)

For social platforms that need a logged-in browser (Twitter/X, Reddit,
XiaoHongShu, Facebook, Instagram), install the upstream project on a
desktop machine; see `docs/repos/panniantong-agent-reach.md`. Don't do
this in a cloud container.
