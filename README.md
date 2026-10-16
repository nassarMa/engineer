# Engineer

A Claude Code agent configured to design and build solutions to software
problems: it frames the problem, designs options, implements in the target
repo, tests, reviews, and ships.

## Layout

| Path | What it is |
|------|------------|
| `CLAUDE.md` | The agent's operating manual: process and engineering standards |
| `.claude/agents/` | Specialists: `architect`, `implementer`, `reviewer`, `tester` |
| `.claude/skills/` | Workflows: `design-solution`, `implement-task`, `onboard-repo` |
| `.claude/settings.json` | Permission allow/deny rules |
| `.mcp.json` | External tools (MCP servers) |
| `templates/` | Design doc and repo-notes templates |
| `docs/designs/` | Designs the agent has produced |
| `docs/repos/` | What the agent knows about each connected repo |
| `docs/connecting-tools.md` | How to add tools and repos |

## Using it

Open a Claude Code session in this repo and describe the problem, e.g.:

- "Design a rate limiter for the API in `owner/service`." → `design-solution`
- "Implement the agreed design." → `implement-task`
- "Onboard `owner/repo`." → `onboard-repo`
