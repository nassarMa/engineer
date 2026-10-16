# Engineer

A Claude Code agent configured to design and build solutions to software
problems: it frames the problem, designs options, implements in the target
repo, tests, reviews, and ships.

## Layout

| Path | What it is |
|------|------------|
| `CLAUDE.md` | The agent's operating manual: process and engineering standards |
| `.claude/agents/` | Specialists: `architect`, `implementer`, `reviewer`, `tester`, `researcher` |
| `.claude/skills/` | Workflows: `design-solution`, `implement-task`, `onboard-repo`, `research`, `codebase-graph` |
| `.claude/settings.json` | Permission allow/deny rules |
| `.mcp.json` | External tools (MCP servers): Exa search, Playwright browser, graphify graph |
| `scripts/` | Helper scripts: Playwright and graphify MCP launchers, graphify build, agent-skills sync |
| `templates/` | Design doc and repo-notes templates |
| `docs/designs/` | Designs the agent has produced |
| `docs/repos/` | What the agent knows about each connected repo |
| `docs/connecting-tools.md` | How to add tools and repos |

## Using it

Open a Claude Code session in this repo and describe the problem, e.g.:

- "Design a rate limiter for the API in `owner/service`." → `design-solution`
- "Implement the agreed design." → `implement-task`
- "Onboard `owner/repo`." → `onboard-repo`
- "How does library X handle retries? What are people saying about Y?" → `research`

## Internet access

The `research` skill gives the agent free, keyless access to web search
(Exa), page reading (Jina Reader), GitHub, YouTube transcripts, RSS, and
developer communities, with fallback chains per source. The routing idea is
adapted from [Agent Reach](https://github.com/Panniantong/agent-reach);
see `docs/repos/panniantong-agent-reach.md` for the full project and how
to install it on a desktop for login-backed platforms.
