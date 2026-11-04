# Video: transcripts, reels and shorts

Two jobs, two tools.

## Long video with captions (YouTube talks, tutorials)

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

## "Watch this" — reels, shorts, clips without captions

Use when the user shares an Instagram reel, TikTok, YouTube Short or X video
and wants you to learn from it. These rarely have subtitles, and the useful
content is split between speech, the post caption and text on screen.

```bash
TMPDIR=<scratchpad dir> WATCH_LANG=ar scripts/watch-video.sh "<url>"
# prints the output dir: info.txt, transcript.txt, sheet.jpg, frames/
```

Then, in this order:

1. **Read `info.txt`.** The caption usually lists every tool or link the
   video names. It is the cheapest and most reliable source.
2. **Read `transcript.txt`.** Local Whisper (`faster-whisper`, CPU), so
   nothing leaves the machine. Set `WATCH_LANG` when you know the language;
   names of products come out phonetically ("Omniraut"), so confirm them
   against the caption and the frames.
3. **Look at `sheet.jpg`** with the image reader, then re-extract any frame
   with small text at full size and crop to it:
   `ffmpeg -ss <sec> -i video.mp4 -frames:v 1 -vf "crop=iw:ih*0.35:0:ih*0.1" f.jpg`.
   Screenshots of GitHub pages give the exact `owner/repo`.
4. **Research each thing it names** from primary sources (the repo, its
   docs, its releases), not from the video's claims. Short-form videos
   oversell; say which claims held up.

The script installs `yt-dlp` and `faster-whisper` into a throwaway venv
under `$TMPDIR`, never system-wide. The Whisper model (~0.5 GB for `small`)
downloads on first run.

Gotchas seen in cloud containers:

- **Instagram** works anonymously for public posts, but a few requests from
  one IP trip a rate limit that redirects to the login page. The script
  makes one request per video; don't retry in a loop.
- **YouTube** often answers 403 to video downloads from cloud IPs, even when
  metadata works. Use the subtitle route above instead.
- When a download is blocked, ask the user to upload the video and pass the
  file path: `scripts/watch-video.sh /path/to/video.mp4`. Never log into an
  account or pass browser cookies to get around a block.
