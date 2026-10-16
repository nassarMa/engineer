# Community discussion

Zero-config:

```bash
# V2EX (Chinese dev community) — hot topics, topic by node
curl -s "https://www.v2ex.com/api/topics/hot.json" -H "User-Agent: engineer-agent/1.0"
curl -s "https://www.v2ex.com/api/topics/show.json?node_name=python" -H "User-Agent: engineer-agent/1.0"

# Hacker News (Algolia API)
curl -s "https://hn.algolia.com/api/v1/search?query=QUERY&tags=story" | jq '.hits[:10][] | {title, url, points, objectID}'
# Comments: https://news.ycombinator.com/item?id=OBJECTID via Jina Reader
```

Reddit, Twitter/X, Stack Overflow: search through Exa with the site named
in the query ("reddit thread about X", "stackoverflow X error"), then read
the result page with Jina Reader. Reddit pages often block bots; try
`old.reddit.com` or append `.json` to the post URL.

Login-backed platforms (Twitter cookies, Reddit cookies, XiaoHongShu,
Facebook, Instagram) are out of scope for the cloud agent. On a desktop,
install Agent Reach itself — see `docs/repos/panniantong-agent-reach.md`.
