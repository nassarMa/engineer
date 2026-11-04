#!/usr/bin/env bash
# Vendor skills from Anthropic's official plugin marketplace
# (anthropics/claude-plugins-official, Apache-2.0) into .claude/skills/.
# Cloud sessions don't install plugins enabled in project settings, so a
# plain vendored copy is the only way every session gets them.
#
# Copies Markdown and the plugin's LICENSE only (no scripts, no hooks), and
# leaves the files unmodified so a re-sync is a clean diff. Our rules for
# using a vendored skill live in CLAUDE.md and our own skills, not in it.
#
#   plugins/<plugin>/skills/<skill>/**.md -> .claude/skills/<skill>/
#   plugins/<plugin>/LICENSE              -> .claude/skills/<skill>/LICENSE
#
# Usage: scripts/sync-official-plugin-skills.sh [git-ref]   (default: pinned REF)
set -euo pipefail

REPO="https://github.com/anthropics/claude-plugins-official"
REF="${1:-fa4eb54}"   # 2026-11-03
PLUGINS=(claude-code-setup)
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

git clone -q --filter=blob:none "$REPO" "$TMP/src"
git -C "$TMP/src" checkout -q "$REF"
SHA="$(git -C "$TMP/src" rev-parse --short HEAD)"

MANIFEST="$ROOT/.claude/official-plugin-skills.manifest"
if [ -f "$MANIFEST" ]; then
  grep -v '^#' "$MANIFEST" | while read -r path; do
    [ -n "$path" ] && rm -rf "$ROOT/$path"
  done
fi
{
  echo "# Vendored by scripts/sync-official-plugin-skills.sh from $REPO @ $SHA"
  echo "# Plugins: ${PLUGINS[*]}. Do not edit these paths by hand; re-run the script."
} > "$MANIFEST"

for plugin in "${PLUGINS[@]}"; do
  src="$TMP/src/plugins/$plugin"
  [ -d "$src/skills" ] || { echo "sync: $plugin has no skills/ at $SHA" >&2; exit 1; }
  for dir in "$src/skills"/*/; do
    name="$(basename "$dir")"
    dest="$ROOT/.claude/skills/$name"
    mkdir -p "$dest"
    (cd "$dir" && find . -name '*.md' -print0 | while IFS= read -r -d '' f; do
      mkdir -p "$dest/$(dirname "$f")"
      cp "$f" "$dest/$f"
    done)
    cp "$src/LICENSE" "$dest/LICENSE"
    echo ".claude/skills/$name" >> "$MANIFEST"
  done
done

echo "Vendored ${PLUGINS[*]} @ $SHA; see $MANIFEST"
