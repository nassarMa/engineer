# Video transcripts (YouTube and 1800+ sites via yt-dlp)

```bash
SCRATCH=<scratchpad dir>
yt-dlp --write-auto-sub --write-sub --sub-lang en --skip-download \
  -o "$SCRATCH/%(id)s" "https://www.youtube.com/watch?v=ID"
# → $SCRATCH/ID.en.vtt
sed -e '/-->/d' -e '/^$/d' -e 's/<[^>]*>//g' "$SCRATCH/ID.en.vtt" | awk '!seen[$0]++'
```

Metadata only: `yt-dlp --dump-json URL | jq '{title, upload_date, duration, description}'`.

Search: `yt-dlp "ytsearch5:query" --flat-playlist --print "%(title)s | %(webpage_url)s"`.

If `yt-dlp` is missing: `pipx install yt-dlp` (ask first; it's a system
change). Don't use yt-dlp for Bilibili (blocked with 412).
