import { mentions, type Brain } from "./model";

export type NodeKind = "manual" | "agent" | "skill" | "vendored-skill" | "command" | "mcp" | "script" | "reference";
export type GraphNode = { id: string; label: string; kind: NodeKind; description: string; path: string; href: string };
export type GraphEdge = { source: string; target: string; why: string };
export type Graph = { nodes: GraphNode[]; edges: GraphEdge[] };

export const KIND_LABEL: Record<NodeKind, string> = {
  manual: "Operating manual",
  agent: "Specialist",
  skill: "Own skill",
  "vendored-skill": "Vendored skill",
  command: "Command",
  mcp: "MCP server",
  script: "Script",
  reference: "Checklist",
};

const id = (kind: string, name: string) => `${kind}:${name}`;

/**
 * Who points at whom. An edge means one file names another by its name,
 * so it is the map of what gets pulled in when a piece of the brain is used.
 */
export function buildGraph(brain: Brain): Graph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  const add = (edge: GraphEdge) => {
    const key = `${edge.source}>${edge.target}`;
    if (edge.source !== edge.target && !seen.has(key)) {
      seen.add(key);
      edges.push(edge);
    }
  };

  nodes.push({ id: "manual:CLAUDE.md", label: "CLAUDE.md", kind: "manual", description: "Read at the start of every session; routes work to skills and specialists.", path: "CLAUDE.md", href: "/manual" });
  for (const a of brain.agents) nodes.push({ id: id("agent", a.name), label: a.name, kind: "agent", description: a.description, path: a.path, href: `/agents/${a.name}` });
  for (const s of brain.skills) nodes.push({ id: id("skill", s.name), label: s.name, kind: s.origin === "own" ? "skill" : "vendored-skill", description: s.description, path: s.path, href: `/skills/${s.name}` });
  for (const c of brain.commands) nodes.push({ id: id("command", c.name), label: `/${c.name}`, kind: "command", description: c.description, path: c.path, href: `/commands/${c.name}` });
  for (const m of brain.mcpServers) nodes.push({ id: id("mcp", m.name), label: m.name, kind: "mcp", description: `${m.transport}: ${m.target}`, path: m.path, href: "/tools" });
  for (const s of brain.scripts) nodes.push({ id: id("script", s.name), label: s.name, kind: "script", description: s.summary, path: s.path, href: "/tools" });
  for (const r of brain.references) nodes.push({ id: id("reference", r.name), label: r.name, kind: "reference", description: r.title, path: r.path, href: `/references/${r.name}` });

  const skillNames = brain.skills.map((s) => s.name);
  const agentNames = brain.agents.map((a) => a.name);
  const commandNames = brain.commands.map((c) => c.name);
  const mcpNames = brain.mcpServers.map((m) => m.name);
  const scriptNames = brain.scripts.map((s) => s.name);
  const referenceNames = brain.references.map((r) => r.name);

  const link = (from: string, text: string, self?: string) => {
    for (const n of mentions(text, skillNames, self)) add({ source: from, target: id("skill", n), why: "names the skill" });
    for (const n of mentions(text, agentNames, self)) add({ source: from, target: id("agent", n), why: "delegates to the specialist" });
    for (const n of commandNames) if (new RegExp(`(^|[\\s\`(])/${n}(?![A-Za-z0-9-])`, "m").test(text)) add({ source: from, target: id("command", n), why: "mentions the command" });
    for (const n of mentions(text, mcpNames, self, true)) add({ source: from, target: id("mcp", n), why: "uses the MCP server" });
    for (const n of mentions(text, scriptNames, self)) add({ source: from, target: id("script", n), why: "runs the script" });
    for (const n of mentions(text, referenceNames, self)) add({ source: from, target: id("reference", n), why: "follows the checklist" });
  };

  link("manual:CLAUDE.md", brain.claudeMd);
  for (const a of brain.agents) link(id("agent", a.name), a.body, a.name);
  for (const s of brain.skills) link(id("skill", s.name), s.body, s.name);
  for (const c of brain.commands) link(id("command", c.name), c.body, c.name);
  for (const r of brain.references) link(id("reference", r.name), r.body, r.name);
  // Scripts launch MCP servers and the sync script maintains the vendored skills.
  for (const m of brain.mcpServers) for (const s of brain.scripts) if (m.target.includes(s.name)) add({ source: id("mcp", m.name), target: id("script", s.name), why: "launched by the script" });

  return { nodes, edges };
}

/** Degree per node, for sizing and the "most connected" list. */
export function degrees(graph: Graph): Map<string, { in: number; out: number }> {
  const map = new Map<string, { in: number; out: number }>();
  for (const n of graph.nodes) map.set(n.id, { in: 0, out: 0 });
  for (const e of graph.edges) {
    const s = map.get(e.source);
    const t = map.get(e.target);
    if (s) s.out++;
    if (t) t.in++;
  }
  return map;
}
