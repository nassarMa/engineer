#!/usr/bin/env bash
# Start Claude Code behind Headroom's local compression proxy (desktop only).
# Headroom compresses tool output, logs and JSON before they reach the model;
# it runs on 127.0.0.1:8787 for the life of this Claude Code session only.
# See docs/designs/2026-11-04-claude-code-addons.md for why it is opt-in.
#
# Not for cloud sessions: their Claude Code can't be pointed at a proxy.
# Prefer an API key; with a Claude subscription, Remote Control is disabled
# while wrapped. Undo any leftover config with: headroom unwrap claude
#
# Install once (pinned): uv tool install --python 3.13 "headroom-ai[all]==0.42.0"
# Usage: scripts/headroom-claude.sh [claude args...]
set -euo pipefail

if ! command -v headroom >/dev/null 2>&1; then
  echo "headroom-claude: headroom is not installed; run" >&2
  echo '  uv tool install --python 3.13 "headroom-ai[all]==0.42.0"' >&2
  exit 1
fi

# The usage beacon is on by default upstream; keep it off. --code-memory none
# stops wrap from registering the Serena MCP server in ~/.claude.json.
export HEADROOM_BEACON=off DO_NOT_TRACK=1
exec headroom wrap claude --code-memory none "$@"
