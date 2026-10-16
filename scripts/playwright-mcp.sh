#!/usr/bin/env bash
# Launch the Playwright MCP server (browser automation for the agent).
# Referenced from .mcp.json. Adapts to the environment:
#   - cloud container: uses the pre-installed Chromium and disables the
#     sandbox (containers lack the user namespaces Chromium's sandbox needs)
#   - desktop: lets Playwright pick its own browser (run
#     `npx @playwright/mcp install-browser` once if none is installed)
# Runs headless and isolated (fresh profile each session, nothing persisted).
set -euo pipefail

VERSION="${PLAYWRIGHT_MCP_VERSION:-0.0.83}"
OUT_DIR="${PLAYWRIGHT_MCP_OUTPUT_DIR:-${TMPDIR:-/tmp}/playwright-mcp}"
mkdir -p "$OUT_DIR"

args=(--headless --isolated --output-dir "$OUT_DIR")

if [ -n "${PLAYWRIGHT_MCP_EXECUTABLE:-}" ]; then
  args+=(--executable-path "$PLAYWRIGHT_MCP_EXECUTABLE")
elif [ -x /opt/pw-browsers/chromium ]; then
  args+=(--executable-path /opt/pw-browsers/chromium)
fi

if [ "${PLAYWRIGHT_MCP_NO_SANDBOX:-}" = "1" ] || [ -f /.dockerenv ] || [ -x /opt/pw-browsers/chromium ]; then
  args+=(--no-sandbox)
fi

# Relative filenames the agent passes (screenshots, PDFs) resolve against the
# server's cwd, so run from the output dir to keep them out of the project.
cd "$OUT_DIR"
exec npx -y "@playwright/mcp@${VERSION}" "${args[@]}" "$@"
