#!/usr/bin/env bash
# Vendor addyosmani/agent-skills (MIT) into this repo so every session,
# including cloud sessions that cannot install plugins, gets the skills.
#
# Copies Markdown only (no executable files from upstream):
#   skills/*              -> .claude/skills/<name>/
#   agents/*.md           -> .claude/agents/
#   references/*.md       -> .claude/references/   (skills link ../../references/)
#   .claude/commands/*.md -> .claude/commands/      (plugin namespace stripped)
#
# Usage: scripts/sync-agent-skills.sh [git-ref]   (default: pinned REF below)
set -euo pipefail

REPO="https://github.com/addyosmani/agent-skills"
REF="${1:-aeac41d}"   # v0.6.13, 2026-10-13
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

git clone -q --filter=blob:none "$REPO" "$TMP/src"
git -C "$TMP/src" checkout -q "$REF"
SHA="$(git -C "$TMP/src" rev-parse --short HEAD)"
VERSION="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$TMP/src/.claude-plugin/plugin.json" | head -1)"

# Remove what the previous sync vendored (listed in the manifest), then copy.
MANIFEST="$ROOT/.claude/agent-skills.manifest"
if [ -f "$MANIFEST" ]; then
  grep -v '^#' "$MANIFEST" | while read -r path; do
    [ -n "$path" ] && rm -rf "$ROOT/$path"
  done
fi
: > "$MANIFEST"

mkdir -p "$ROOT/.claude/skills" "$ROOT/.claude/agents" "$ROOT/.claude/references" "$ROOT/.claude/commands"

for dir in "$TMP/src/skills"/*/; do
  name="$(basename "$dir")"
  mkdir -p "$ROOT/.claude/skills/$name"
  # Markdown only; upstream helper scripts are intentionally not vendored.
  (cd "$dir" && find . -name '*.md' -print0 | while IFS= read -r -d '' f; do
    mkdir -p "$ROOT/.claude/skills/$name/$(dirname "$f")"
    cp "$f" "$ROOT/.claude/skills/$name/$f"
  done)
  echo ".claude/skills/$name" >> "$MANIFEST"
done

for f in "$TMP/src/references"/*.md; do
  cp "$f" "$ROOT/.claude/references/"
  echo ".claude/references/$(basename "$f")" >> "$MANIFEST"
done
for f in "$TMP/src/agents"/*.md; do
  cp "$f" "$ROOT/.claude/agents/"
  echo ".claude/agents/$(basename "$f")" >> "$MANIFEST"
done
for f in "$TMP/src/.claude/commands"/*.md; do
  cp "$f" "$ROOT/.claude/commands/"
  echo ".claude/commands/$(basename "$f")" >> "$MANIFEST"
done

# Plugin-namespaced skill names (agent-skills:foo) become plain names here.
grep -rl "agent-skills:" "$ROOT/.claude/skills" "$ROOT/.claude/agents" "$ROOT/.claude/commands" 2>/dev/null \
  | xargs -r sed -i 's/agent-skills:\([a-z-]*\)/\1/g'

cp "$TMP/src/LICENSE" "$ROOT/.claude/references/LICENSE-agent-skills"
echo ".claude/references/LICENSE-agent-skills" >> "$MANIFEST"
printf '# addyosmani/agent-skills v%s @ %s - vendored by scripts/sync-agent-skills.sh\n' "$VERSION" "$SHA" >> "$MANIFEST"

echo "Vendored agent-skills v$VERSION ($SHA)"
