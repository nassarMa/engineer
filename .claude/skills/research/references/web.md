# Reading web pages and feeds

## Jina Reader (first choice)

```bash
curl -s "https://r.jina.ai/https://example.com/page"
```

Returns `Title`, `URL Source`, then Markdown. Pipe long pages into a
scratch file and read the relevant part. Add `-H "X-No-Cache: true"` if
you get a stale cached snapshot. If the body contains "Just a moment..."
or "requiring captcha", the site blocks bots → fall back.

## Fallbacks

1. Exa `web_fetch_exa(url)`
2. `WebFetch` tool
3. For GitHub-hosted docs, read the raw file:
   `curl -s https://raw.githubusercontent.com/owner/repo/main/README.md`

## RSS / Atom feeds

```bash
curl -s "FEED_URL" | python3 -c "
import sys, xml.etree.ElementTree as ET
root = ET.parse(sys.stdin).getroot()
for item in (root.iter('item') or root.iter('{http://www.w3.org/2005/Atom}entry')):
    print(item.findtext('title'), '—', item.findtext('link'))
" | head -20
```

Release feeds: `gh release list -R owner/repo` (the `releases.atom` URL is blocked
by some proxies, including this cloud container).
