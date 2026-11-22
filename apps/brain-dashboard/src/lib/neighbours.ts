import type { Graph } from "./graph";

/** Links in and out of one node, plus a label map for rendering them. */
export function neighboursOf(graph: Graph, id: string) {
  const out = graph.edges.filter((e) => e.source === id).map((e) => e.target);
  const inn = graph.edges.filter((e) => e.target === id).map((e) => e.source);
  const labels = new Map(graph.nodes.map((n) => [n.id, { label: n.label, href: n.href }]));
  return { out, in: inn, labels };
}
