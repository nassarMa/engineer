#!/usr/bin/env bash
# Run the Vercel CLI with the account token from the environment.
#
#   VERCEL_TOKEN        required: a Vercel access token (Account Settings →
#                       Tokens). Set it as an environment secret, never in a
#                       file in this repo and never pasted into chat.
#   VERCEL_TEAM         optional: team slug or id to act as (--scope).
#   VERCEL_ORG_ID /     optional: the CLI reads these natively to target a
#   VERCEL_PROJECT_ID   project without a .vercel/ link directory.
#   VERCEL_CLI_VERSION  optional: pin override (default below).
#
# Usage: scripts/vercel.sh <any vercel command and flags>
#   scripts/vercel.sh deploy --cwd path/to/app            # preview deployment
#   scripts/vercel.sh deploy --cwd path/to/app --prod     # production
#   scripts/vercel.sh ls | inspect <url> --logs | rollback | env ls
set -euo pipefail

VERSION="${VERCEL_CLI_VERSION:-65.0.0}"

if [ -z "${VERCEL_TOKEN:-}" ]; then
  cat >&2 <<'EOF'
vercel: VERCEL_TOKEN is not set.
Create a token at https://vercel.com/account/tokens and add it as the
VERCEL_TOKEN environment secret (cloud: environment settings → Network
secrets / environment variables; local: your shell, not a committed file).
EOF
  exit 1
fi

args=(--token "$VERCEL_TOKEN")
if [ -n "${VERCEL_TEAM:-}" ]; then args+=(--scope "$VERCEL_TEAM"); fi

# `--yes` skips interactive prompts (project set-up questions) so the CLI
# never blocks waiting for a terminal.
case "${1:-}" in
  deploy|link|pull|build|"") args+=(--yes) ;;
esac

exec npx -y "vercel@${VERSION}" "$@" "${args[@]}"
