---
skill: research
type: misfire
status: applied
date: 2026-11-04
---
**What happened:** The user shared an Instagram reel to learn from. The
research skill said Instagram needs a logged-in desktop browser, but
anonymous yt-dlp downloaded the public reel from the cloud container. The
reel had no captions, so the useful content was in the post caption, the
speech and the screenshots on screen. A second download a few minutes later
was rate-limited to the login page.

**Proposed change:** Route "watch this" reels to a script that downloads
once, transcribes with local Whisper and tiles frames; document the
Instagram rate limit and the upload-the-file fallback. Applied as
`scripts/watch-video.sh` and the reel section of `research/references/video.md`.
