#!/usr/bin/env bash
# Launch graphify's MCP server over a built knowledge graph.
# Referenced from .mcp.json. Needs graphifyy installed (see docs/repos/
# graphify-labs-graphify.md) and a graph built by scripts/graphify-build.sh.
#
#   GRAPHIFY_GRAPH    path to graph.json (default: graphify-out/graph.json
#                     under the current project, i.e. the engineer repo itself,
#                     or set it to <target-repo>/graphify-out/graph.json)
#   GRAPHIFY_PYTHON   interpreter that has graphify importable (auto-detected)
set -euo pipefail

GRAPH="${GRAPHIFY_GRAPH:-graphify-out/graph.json}"

find_python() {
  if [ -n "${GRAPHIFY_PYTHON:-}" ]; then echo "$GRAPHIFY_PYTHON"; return; fi
  # The graphify skill records its interpreter beside the graph it built.
  local hint="$(dirname "$GRAPH")/.graphify_python"
  if [ -f "$hint" ] && [ -x "$(cat "$hint")" ]; then cat "$hint"; return; fi
  # Only use uv's copy if graphifyy is already installed as a uv tool;
  # `uv tool run --from graphifyy` would download it on first use, and this
  # launcher must never install anything on its own.
  if command -v uv >/dev/null 2>&1 && uv tool list 2>/dev/null | grep -q '^graphifyy '; then
    local p; p="$(uv tool run --from graphifyy python -c 'import sys;print(sys.executable)' 2>/dev/null || true)"
    if [ -n "$p" ]; then echo "$p"; return; fi
  fi
  if command -v graphify >/dev/null 2>&1; then
    local shebang; shebang="$(head -1 "$(command -v graphify)" | tr -d '#!' | awk '{print $1}')"
    if [ -x "$shebang" ] && "$shebang" -c 'import graphify' 2>/dev/null; then echo "$shebang"; return; fi
  fi
  if python3 -c 'import graphify' 2>/dev/null; then echo python3; return; fi
  echo ""
}

PY="$(find_python)"
if [ -z "$PY" ]; then
  echo "graphify-mcp: graphifyy is not installed; run 'uv tool install \"graphifyy[mcp]\"' or 'pipx install \"graphifyy[mcp]\"'" >&2
  exit 1
fi
if [ ! -f "$GRAPH" ]; then
  echo "graphify-mcp: no graph at $GRAPH; build one with scripts/graphify-build.sh <path>" >&2
  exit 1
fi

exec "$PY" -m graphify.serve "$GRAPH"
