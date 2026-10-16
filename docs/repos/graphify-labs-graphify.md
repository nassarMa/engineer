# Graphify-Labs/graphify

- **Purpose:** Turns a folder (code, docs, PDFs, images, video) into a
  queryable knowledge graph so an agent can ask "what calls X / how do A
  and B connect" instead of grepping. Open-source core of Graphify Cloud
  (YC S26).
- **Language / framework:** Python ≥3.10, tree-sitter grammars for ~40
  languages, NetworkX, Leiden clustering. Apache-2.0.
- **Package:** PyPI `graphifyy` (double y; other `graphify*` packages are
  unaffiliated). CLI command is `graphify`.
- **Default branch:** v8 (studied at `10130e7`, v0.9.91, 2026-10-14)
- **Last onboarded:** 2026-10-16 (installed via `uv tool install
  "graphifyy[mcp]"`; code-only build of agent-reach: 76 files → 1,542 nodes,
  3,441 edges, 92 communities in 9 s)

## How it works

```
detect → extract (tree-sitter AST per file) → build (NetworkX) → cluster (Leiden)
      → analyze (god nodes, surprises, cycles) → report → export (json/html/wiki/…)
```

- Code extraction is local and deterministic: no LLM, no key, nothing sent
  anywhere. A code-only corpus (`graphify extract <path> --code-only`)
  needs nothing else.
- Docs/PDFs/images get a *semantic* pass that needs an LLM. The `/graphify`
  skill uses Gemini if `GEMINI_API_KEY`/`GOOGLE_API_KEY` is set, otherwise
  it makes the host agent (this session) extract via subagents. Headless
  `graphify extract` can use `--backend gemini|claude|openai|…`.
- Edges carry a confidence tag: `EXTRACTED`, `INFERRED`, `AMBIGUOUS`.
- Output: `graphify-out/graph.json` (the graph), `GRAPH_REPORT.md`
  (god nodes, communities, surprising connections, suggested questions),
  `graph.html` (interactive), optional wiki/Obsidian/SVG/GraphML/Neo4j.

## Commands that matter

| Task | Command |
|------|---------|
| Build (code only, no key) | `graphify extract <path> --code-only` |
| Incremental refresh | `graphify update <path>` |
| Ask | `graphify query "<question>" [--dfs] [--budget N]` |
| Relationship | `graphify path "A" "B"` |
| One concept | `graphify explain "X"` |
| Blast radius of a change | `graphify affected <files…>` |
| MCP server | `python -m graphify.serve graphify-out/graph.json` |
| Install the `/graphify` skill into a repo | `graphify install --project` → `.claude/skills/graphify/SKILL.md` + `references/`, and a `## graphify` block in `.claude/CLAUDE.md` |
| Git hook (rebuild after commit) | `graphify hook install` |

MCP tools: `query_graph`, `get_node`, `get_neighbors`, `get_community`,
`god_nodes`, `graph_stats`, `shortest_path`, `list_prs`, `get_pr_impact`,
`triage_prs`; resources `graphify://report|stats|god-nodes|surprises|audit|questions`.

## How it fits this engineer

- `.claude/skills/codebase-graph/` — our own wrapper: build with
  `scripts/graphify-build.sh`, query with the CLI, rules for when to use
  the graph before grep. Written here, not vendored.
- `scripts/graphify-mcp.sh` + `.mcp.json` `graphify` entry — serves a built
  graph as MCP tools. Needs `graphifyy[mcp]` installed and
  `GRAPHIFY_GRAPH` pointing at the target repo's `graphify-out/graph.json`.
- `onboard-repo` skill — builds the code graph as part of learning a repo.
- The full upstream `/graphify` skill (semantic extraction of docs via
  subagents, GitHub-URL cloning, cross-repo merge, exports) is not vendored;
  install it per repo with `graphify install --project` if wanted.

## Benchmarks claimed upstream

LOCOMO recall@10 0.497 (mem0 0.048), LongMemEval-S 76%, zero LLM credits
for the build. See BENCHMARKS.md upstream; not reproduced here.

## Gotchas

- Node matching in `query` is literal substring on labels: no stemming or
  synonyms. Use the code's own identifiers.
- `graphify-out/graph.json` is rewritten whole on each build; large diffs
  are expected if a repo commits it. Upstream `.gitignore`s it.
- The always-on CLAUDE.md block upstream writes is pushy ("query before
  your first grep"); we adopt a softer version in our own skill.
- Semantic pass cost: docs are chunked 20–25 files per subagent; a big docs
  corpus is many LLM calls. Default to `--code-only`.
- `uv tool install graphifyy` pulls ~25 tree-sitter wheels; `tree-sitter-dm`
  (optional) needs a C toolchain on Linux/macOS.
