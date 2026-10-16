# Connecting tools and repositories

## Adding a tool (MCP server)

Tools are added as MCP servers in `.mcp.json`. Each entry is either a local
command (stdio) or a remote URL (http). Put secrets in environment variables,
never in the file.

```json
{
  "mcpServers": {
    "example-local": {
      "command": "npx",
      "args": ["-y", "some-mcp-server"],
      "env": { "API_KEY": "${EXAMPLE_API_KEY}" }
    },
    "example-remote": {
      "type": "http",
      "url": "https://example.com/mcp",
      "headers": { "Authorization": "Bearer ${EXAMPLE_TOKEN}" }
    }
  }
}
```

You can also add one from the CLI: `claude mcp add --scope project <name> -- <command>`.

Claude.ai connectors (GitHub, Google Drive, databases, etc.) can instead be
connected in claude.ai Settings → Connectors; they then appear in sessions
without any entry here.

After adding a tool, add a line to the table below so the agent knows when to
reach for it.

| Tool | What it's for | When the agent should use it |
|------|---------------|------------------------------|
| `exa` (remote MCP, no key) | Web search and page fetch | Any lookup of docs, errors, comparisons — via the `research` skill |
| `graphify` (local, `scripts/graphify-mcp.sh`) | Query a repo's knowledge graph: `query_graph`, `get_neighbors`, `shortest_path`, `god_nodes`, PR impact | Understanding an unfamiliar codebase; needs `graphifyy[mcp]` installed and `GRAPHIFY_GRAPH` pointing at a built `graph.json` |
| `playwright` (local, `scripts/playwright-mcp.sh`) | Headless browser: navigate, snapshot, click, fill forms, screenshots, console and network logs | Verifying a web UI change in a real browser, reproducing a frontend bug, reading pages that need JavaScript, end-to-end checks |

### Playwright notes

- Runs `@playwright/mcp` (pinned in the wrapper) headless with a fresh,
  in-memory profile each session; nothing is persisted.
- In the cloud container it uses the pre-installed Chromium with the
  sandbox off. On a desktop, install a browser once with
  `npx @playwright/mcp install-browser` if the server reports none.
- Screenshots and snapshots go to `$TMPDIR/playwright-mcp` (override with
  `PLAYWRIGHT_MCP_OUTPUT_DIR`), never into the repo.
- Never log into real accounts or enter credentials through it; use it on
  local dev servers, staging, and public pages.

## Adding a repository

1. Give the agent access (on claude.ai: add the repo to the session or
   environment; locally: clone it under `workspace/`, which is git-ignored).
2. Ask the agent to run the `onboard-repo` skill on it. That writes
   `docs/repos/<owner>-<repo>.md` with the build/test commands, architecture,
   and conventions, so later tasks start with that knowledge.
