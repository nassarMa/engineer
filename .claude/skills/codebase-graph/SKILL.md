---
name: codebase-graph
description: Understand a codebase through a knowledge graph instead of grepping — who calls what, how two modules connect, what the god nodes and subsystems are. Use when onboarding a repo, before changing unfamiliar code, or for any "how does X work / what depends on Y" question. Backed by graphify (tree-sitter AST, local, no API key).
---

# Codebase graph (graphify)

graphify parses a repo with tree-sitter into a graph of files, classes,
functions and their `calls` / `imports` / `inherits` edges, clusters it
into subsystems, and lets you query it. Code parsing is deterministic and
local; no LLM and no key. Every edge is tagged `EXTRACTED` (explicit in
source) or `INFERRED` (resolved by graphify): say which when you cite one.

## Build

```bash
scripts/graphify-build.sh <repo-path>        # code only; writes <repo>/graphify-out/
scripts/graphify-build.sh <repo-path>        # again later = incremental update
```

Requires the `graphify` CLI (`uv tool install "graphifyy[mcp]"`; the PyPI
name is `graphifyy`, double y). If it is missing, say so and fall back to
Grep/Read; do not install system packages without asking.

`--with-docs` adds a semantic pass over docs, PDFs and images. That pass
sends their content to an LLM (Gemini if a key is set, otherwise this
session does the extraction via the upstream `/graphify` skill). Only use
it when the user wants docs in the graph and the content may leave the
machine.

## Query (run inside the repo that has `graphify-out/`)

```bash
graphify query "<question>"          # scoped subgraph for a plain-language question (BFS)
graphify query "<question>" --dfs    # trace a chain: "how does X reach Y"
graphify path "AuthModule" "Database"   # shortest path between two concepts
graphify explain "APIRouter"         # one node: source, community, connections
graphify affected <file> ...         # what a change to these files touches
```

Matching is literal substring on node labels: use identifiers the code
uses (`handler`, not "the thing that handles requests"). If a query returns
nothing, try the exact symbol name, then fall back to Grep.

Read `graphify-out/GRAPH_REPORT.md` for a whole-architecture overview:
god nodes (most connected), communities (subsystems), surprising
cross-community links, suggested questions.

## Rules

- When `graphify-out/graph.json` exists in the target repo, query the graph
  before the first Grep or file read for a codebase question, and read raw
  files only for lines the graph located. Put this rule in subagent prompts
  that explore that repo.
- After editing code, run `scripts/graphify-build.sh <repo>` to refresh.
- `graphify-out/` belongs to the target repo. Don't commit it unless that
  repo already does; it is rewritten whole on every build.
- The MCP server (`graphify` in `.mcp.json`) exposes the same graph as
  tools (`query_graph`, `get_node`, `get_neighbors`, `shortest_path`,
  `god_nodes`, `graph_stats`, PR-impact tools). Point it at a graph with
  `GRAPHIFY_GRAPH=<repo>/graphify-out/graph.json`; it only starts when that
  file exists.
