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
| _none yet_ | | |

## Adding a repository

1. Give the agent access (on claude.ai: add the repo to the session or
   environment; locally: clone it under `workspace/`, which is git-ignored).
2. Ask the agent to run the `onboard-repo` skill on it. That writes
   `docs/repos/<owner>-<repo>.md` with the build/test commands, architecture,
   and conventions, so later tasks start with that knowledge.
