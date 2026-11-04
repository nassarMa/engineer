#!/usr/bin/env bash
# "Watch" a short video (Instagram reel, TikTok, YouTube Short, X video, ...)
# so the agent can learn from it: metadata + caption, a speech transcript, and
# a contact sheet of frames to read on-screen text with the image reader.
# Used by the `research` skill (see .claude/skills/research/references/video.md).
#
# Usage: scripts/watch-video.sh <url|local-video-file> [out-dir]
#   out-dir defaults to $TMPDIR/watch-video/<id>; never point it into a repo.
#   Pass a local file (e.g. one the user uploaded) when the site blocks
#   downloads; the transcript and frames work the same.
#
#   WATCH_LANG          speech language for Whisper (default: auto-detect),
#                       e.g. ar, en
#   WATCH_MODEL         faster-whisper model (default: small)
#   WATCH_FRAME_EVERY   seconds between frames (default: spread 24 frames,
#                       one contact sheet, over the whole video; min 1)
#   WATCH_VENV          venv holding yt-dlp + faster-whisper (default:
#                       $TMPDIR/watch-video-venv). Created on first run; this
#                       installs into that throwaway venv only, never system-wide.
#
# Output in out-dir: video.mp4, info.txt (title, uploader, date, caption),
# transcript.txt ([seconds] text), frames/fNNN.jpg, sheet.jpg (tiled frames).
# Needs python3 and ffmpeg. Works anonymously for public posts; private or
# login-walled posts fail, and the agent must not use real accounts for them.
set -euo pipefail

URL="${1:?usage: scripts/watch-video.sh <url> [out-dir]}"
TMP="${TMPDIR:-/tmp}"
VENV="${WATCH_VENV:-$TMP/watch-video-venv}"
MODEL="${WATCH_MODEL:-small}"
YTDLP_VERSION="2026.10.26"
WHISPER_VERSION="1.2.1"

command -v ffmpeg >/dev/null || { echo "watch-video: ffmpeg is required" >&2; exit 1; }

if [ ! -x "$VENV/bin/yt-dlp" ] || ! "$VENV/bin/python" -c 'import faster_whisper' 2>/dev/null; then
  echo "watch-video: setting up $VENV (yt-dlp, faster-whisper)" >&2
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -q --disable-pip-version-check \
    "yt-dlp>=$YTDLP_VERSION" "faster-whisper>=$WHISPER_VERSION"
fi

if [ -f "$URL" ]; then
  OUT="${2:-$TMP/watch-video/$(basename "${URL%.*}")}"
  mkdir -p "$OUT/frames"
  ffmpeg -v error -y -i "$URL" -c copy "$OUT/video.mp4"
  echo '{"title": "local file", "webpage_url": null}' > "$OUT/video.info.json"
else
  # One request only: Instagram rate-limits anonymous access after a few
  # posts per IP, and then redirects to its login page.
  BASE="$TMP/watch-video"
  FILE="$("$VENV/bin/yt-dlp" --no-warnings -q -f "b[ext=mp4]/bv*+ba/b" --merge-output-format mp4 \
    --write-info-json --print after_move:filepath -o "$BASE/%(id)s/video.%(ext)s" "$URL")" || {
    echo "watch-video: download failed. If the site asked for a login or rate-limited," >&2
    echo "ask the user to upload the video file and pass its path instead." >&2
    exit 1; }
  OUT="${2:-$(dirname "$FILE")}"
  if [ "$OUT" != "$(dirname "$FILE")" ]; then mkdir -p "$OUT"; mv "$(dirname "$FILE")"/video.* "$OUT"/; fi
  mkdir -p "$OUT/frames"
fi

# Metadata and caption. The caption often lists every tool or link the video
# mentions, so read it first.
"$VENV/bin/python" -I - "$OUT/video.info.json" > "$OUT/info.txt" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
for k in ("title", "uploader", "channel", "upload_date", "duration", "webpage_url"):
    print(f"{k}: {d.get(k)}")
print("\ncaption:\n" + (d.get("description") or ""))
PY

# Transcript. Audio is decoded by ffmpeg and passed as samples, which avoids
# depending on PyAV's container API.
"$VENV/bin/python" -I - "$OUT/video.mp4" "$MODEL" "${WATCH_LANG:-}" > "$OUT/transcript.txt" <<'PY'
import subprocess, sys
import numpy as np
from faster_whisper import WhisperModel
path, model, lang = sys.argv[1], sys.argv[2], sys.argv[3] or None
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "s16le", "-ac", "1",
                      "-ar", "16000", "-"], capture_output=True, check=True).stdout
audio = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
segments, info = WhisperModel(model, device="cpu", compute_type="int8").transcribe(audio, language=lang)
print(f"# language: {info.language} ({info.language_probability:.2f})")
for s in segments:
    print(f"[{s.start:6.1f}] {s.text.strip()}")
PY

# Frames and a contact sheet. Read sheet.jpg first, then the single frames
# (or re-extract one at full size with ffmpeg -ss <t>) to read small text
# such as GitHub repo names in screenshots.
DUR="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/video.mp4")"
EVERY="${WATCH_FRAME_EVERY:-$(awk -v d="$DUR" 'BEGIN { e = int(d / 24 + 0.999); print (e < 1 ? 1 : e) }')}"
ffmpeg -v error -y -i "$OUT/video.mp4" -vf "fps=1/$EVERY,scale=480:-1" "$OUT/frames/f%03d.jpg"
ffmpeg -v error -y -pattern_type glob -i "$OUT/frames/f*.jpg" -vf "tile=6x4" -frames:v 1 "$OUT/sheet.jpg"

echo "$OUT"
