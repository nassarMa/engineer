# Web search

## Exa (MCP server `exa`, no API key)

`web_search_exa(query, numResults=5)` — describe the ideal page, not keywords:
"blog post comparing React and Vue rendering performance", not "react vs vue".
Add `category:company` / `category:people` for LinkedIn-style lookups.

`web_fetch_exa(url)` — fetch one page when search highlights aren't enough.

Good for: English technical docs, official examples, error messages (paste
the exact message in quotes), recent news.

## Fallback: `WebSearch` tool

Use when Exa errors or returns nothing useful. Use `mode: "extended"` for
niche or very recent topics.

## Tips

- Search the exact error string first, then a paraphrase.
- Add the version: "sqlalchemy 2.0 async session example".
- For "what do people think of X", search "X review", "X vs", "X problems".
