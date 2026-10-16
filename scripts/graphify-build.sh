#!/usr/bin/env bash
# Build (or refresh) a graphify knowledge graph for a repository.
# Code-only by default: deterministic tree-sitter parse, no LLM, no API key,
# nothing leaves the machine. Output lands in <path>/graphify-out/.
#
# Usage: scripts/graphify-build.sh <repo-path> [--with-docs] [extra graphify flags]
#   --with-docs   also run the semantic pass over docs/PDFs/images. That pass
#                 needs an LLM: it uses Gemini if GEMINI_API_KEY/GOOGLE_API_KEY
#                 is set, otherwise the /graphify skill drives it from inside the
#                 session. Content of those files is sent to that model.
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "usage: $0 <repo-path> [--with-docs] [graphify extract flags]" >&2
  exit 2
fi
TARGET="$1"; shift
MODE=(--code-only)
if [ "${1:-}" = "--with-docs" ]; then MODE=(); shift; fi

if ! command -v graphify >/dev/null 2>&1; then
  cat >&2 <<'EOF'
graphify-build: 'graphify' CLI not found. Install it (official PyPI name is
graphifyy, double y) with one of:
  uv tool install "graphifyy[mcp]"
  pipx install "graphifyy[mcp]"
EOF
  exit 1
fi

if [ ! -d "$TARGET" ]; then
  echo "graphify-build: $TARGET is not a directory" >&2
  exit 2
fi

if [ -f "$TARGET/graphify-out/graph.json" ]; then
  # Incremental: re-extracts only changed files.
  graphify update "$TARGET" "$@"
else
  graphify extract "$TARGET" "${MODE[@]}" "$@"
fi
# extract/update write graph.json; the report and community names come from
# a separate clustering pass (no LLM).
graphify cluster-only "$TARGET"

echo
echo "Graph: $TARGET/graphify-out/graph.json"
echo "Report: $TARGET/graphify-out/GRAPH_REPORT.md"
echo "Query:  (cd $TARGET && graphify query \"<question>\" | graphify path \"A\" \"B\" | graphify explain \"X\")"
