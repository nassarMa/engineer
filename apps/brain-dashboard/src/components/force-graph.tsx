"use client";

import * as d3 from "d3";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { KIND_LABEL, type Graph, type GraphNode, type NodeKind } from "@/lib/graph";
import { KIND_COLOR } from "./ui";

type SimNode = GraphNode & d3.SimulationNodeDatum & { degree: number };
type SimLink = d3.SimulationLinkDatum<SimNode> & { why: string };

const ALL_KINDS = Object.keys(KIND_LABEL) as NodeKind[];

/**
 * The brain as a map: every piece is a dot, every mention is a line with an
 * arrow from the file that mentions to the file mentioned. Hover to see a
 * piece's neighbours; click to read about it on the side.
 */
export function ForceGraph({ graph, degree, initial }: { graph: Graph; degree: Record<string, number>; initial?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [kinds, setKinds] = useState<Set<NodeKind>>(new Set(ALL_KINDS));
  const [selected, setSelected] = useState<string | null>(initial ?? null);
  const [hovered, setHovered] = useState<string | null>(null);

  const visible = useMemo(() => {
    const nodes = graph.nodes.filter((n) => kinds.has(n.kind));
    const ids = new Set(nodes.map((n) => n.id));
    const edges = graph.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    return { nodes, edges };
  }, [graph, kinds]);

  const neighbours = useMemo(() => {
    const map = new Map<string, { out: { id: string; why: string }[]; in: { id: string; why: string }[] }>();
    for (const n of graph.nodes) map.set(n.id, { out: [], in: [] });
    for (const e of graph.edges) {
      map.get(e.source)?.out.push({ id: e.target, why: e.why });
      map.get(e.target)?.in.push({ id: e.source, why: e.why });
    }
    return map;
  }, [graph]);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const width = svgEl.clientWidth || 900;
    const height = svgEl.clientHeight || 640;
    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    const nodes: SimNode[] = visible.nodes.map((n) => ({ ...n, degree: degree[n.id] ?? 0 }));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const links: SimLink[] = visible.edges.map((e) => ({ source: byId.get(e.source)!, target: byId.get(e.target)!, why: e.why }));
    const radius = (n: SimNode) => 5 + Math.sqrt(n.degree) * 2.2;

    svg.append("defs").append("marker").attr("id", "arrow").attr("viewBox", "0 -4 8 8").attr("refX", 8).attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto").append("path").attr("d", "M0,-4L8,0L0,4").attr("fill", "var(--muted)");

    const root = svg.append("g");
    const link = root.append("g").attr("stroke", "var(--line)").attr("stroke-width", 1.1).selectAll("line").data(links).join("line").attr("marker-end", "url(#arrow)");
    const node = root
      .append("g")
      .selectAll<SVGGElement, SimNode>("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => `${KIND_LABEL[d.kind]} ${d.label}`);
    node.append("circle").attr("r", radius).attr("fill", (d) => KIND_COLOR[d.kind]).attr("stroke", "var(--surface)").attr("stroke-width", 1.5);
    // Labels for the busiest and the most distinctive pieces always; the rest appear on hover.
    const labelled = (d: SimNode) => d.degree >= 8 || d.kind !== "vendored-skill";
    node
      .append("text")
      .text((d) => d.label)
      .attr("class", "lbl")
      .attr("display", (d) => (labelled(d) ? null : "none"))
      .attr("x", (d) => radius(d) + 4)
      .attr("y", 4)
      .attr("font-size", 11)
      .attr("font-family", "var(--mono)")
      .attr("fill", "var(--ink)")
      .attr("paint-order", "stroke")
      .attr("stroke", "var(--surface)")
      .attr("stroke-width", 3);

    const focus = (id: string | null) => {
      const near = new Set<string>();
      if (id) {
        near.add(id);
        for (const l of links) {
          const s = (l.source as SimNode).id;
          const t = (l.target as SimNode).id;
          if (s === id) near.add(t);
          if (t === id) near.add(s);
        }
      }
      node.attr("opacity", (d) => (!id || near.has(d.id) ? 1 : 0.15));
      node.select("text").attr("display", (d) => (labelled(d) || (id && near.has(d.id)) ? null : "none"));
      link.attr("stroke", (l) => (id && ((l.source as SimNode).id === id || (l.target as SimNode).id === id) ? "var(--accent)" : "var(--line)")).attr("opacity", (l) => (!id || (l.source as SimNode).id === id || (l.target as SimNode).id === id ? 1 : 0.12));
    };

    node
      .on("mouseenter", (_, d) => {
        setHovered(d.id);
        focus(d.id);
      })
      .on("mouseleave", () => {
        setHovered(null);
        focus(null);
      })
      .on("click", (_, d) => setSelected(d.id))
      .on("keydown", (event: KeyboardEvent, d) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setSelected(d.id);
        }
      });

    const simulation = d3
      .forceSimulation(nodes)
      .force("link", d3.forceLink<SimNode, SimLink>(links).id((d) => d.id).distance(95).strength(0.35))
      .force("charge", d3.forceManyBody().strength(-420))
      .force("collide", d3.forceCollide<SimNode>().radius((d) => radius(d) + 18))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("x", d3.forceX(width / 2).strength(0.03))
      .force("y", d3.forceY(height / 2).strength(0.05))
      .on("tick", () => {
        link
          .attr("x1", (d) => (d.source as SimNode).x!)
          .attr("y1", (d) => (d.source as SimNode).y!)
          .attr("x2", (d) => {
            const s = d.source as SimNode;
            const t = d.target as SimNode;
            const dx = t.x! - s.x!;
            const dy = t.y! - s.y!;
            const len = Math.hypot(dx, dy) || 1;
            return t.x! - (dx / len) * (radius(t) + 2);
          })
          .attr("y2", (d) => {
            const s = d.source as SimNode;
            const t = d.target as SimNode;
            const dx = t.x! - s.x!;
            const dy = t.y! - s.y!;
            const len = Math.hypot(dx, dy) || 1;
            return t.y! - (dy / len) * (radius(t) + 2);
          });
        node.attr("transform", (d) => `translate(${d.x},${d.y})`);
      });

    node.call(
      d3
        .drag<SVGGElement, SimNode>()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }),
    );

    svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 4])
        .on("zoom", (event) => root.attr("transform", event.transform)),
    );

    return () => {
      simulation.stop();
    };
  }, [visible, degree]);

  const current = graph.nodes.find((n) => n.id === (selected ?? hovered));
  const label = (id: string) => graph.nodes.find((n) => n.id === id)?.label ?? id;

  return (
    <div className="graph-wrap">
      <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
        <div className="legend" role="group" aria-label="Show kinds">
          {ALL_KINDS.map((k) => (
            <label key={k}>
              <input
                type="checkbox"
                checked={kinds.has(k)}
                onChange={(e) => {
                  const next = new Set(kinds);
                  if (e.target.checked) next.add(k);
                  else next.delete(k);
                  setKinds(next);
                }}
              />
              <span className="sw" style={{ background: KIND_COLOR[k] }} aria-hidden />
              {KIND_LABEL[k]} <span className="muted">({graph.nodes.filter((n) => n.kind === k).length})</span>
            </label>
          ))}
        </div>
        <svg ref={svgRef} className="graph-svg" role="img" aria-label={`Map of ${visible.nodes.length} pieces and ${visible.edges.length} links between them`} />
        <p className="small muted">Dot size grows with the number of links. Vendored skills with few links are unlabelled until you hover near them. An arrow points from the file that names another to the file it names. Drag to move, scroll to zoom, click a dot for details.</p>
      </div>
      <aside className="panel" aria-live="polite">
        {current ? (
          <>
            <div>
              <span className="pill kind" style={{ background: KIND_COLOR[current.kind] }}>
                {KIND_LABEL[current.kind]}
              </span>
            </div>
            <h3 className="mono">{current.label}</h3>
            <p className="muted">{current.description}</p>
            <p>
              <Link href={current.href}>Open page</Link> · <span className="mono small">{current.path}</span>
            </p>
            <div>
              <b>Points at ({neighbours.get(current.id)?.out.length ?? 0})</b>
              <ul>
                {(neighbours.get(current.id)?.out ?? []).map((n) => (
                  <li key={n.id}>
                    <button className="linkish mono" onClick={() => setSelected(n.id)}>
                      {label(n.id)}
                    </button>{" "}
                    <span className="muted small">{n.why}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <b>Pointed at by ({neighbours.get(current.id)?.in.length ?? 0})</b>
              <ul>
                {(neighbours.get(current.id)?.in ?? []).map((n) => (
                  <li key={n.id}>
                    <button className="linkish mono" onClick={() => setSelected(n.id)}>
                      {label(n.id)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <>
            <h3>Pick a piece</h3>
            <p className="muted">Hover or click a dot to see what it is, what it pulls in, and what pulls it in.</p>
            <p className="muted small">The manual (CLAUDE.md) sits at the centre: it is the only file read every session. Everything else loads when a task matches it or another file names it.</p>
          </>
        )}
      </aside>
    </div>
  );
}
