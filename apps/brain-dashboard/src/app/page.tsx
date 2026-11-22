import Link from "next/link";
import { Bars, Card, KIND_COLOR, Pill, Tile, ago } from "@/components/ui";
import { getBrain } from "@/lib/brain";
import { KIND_LABEL, type NodeKind } from "@/lib/graph";

export const revalidate = 300;

export default async function OverviewPage() {
  const { brain, graph, degree, checks } = await getBrain();
  const own = brain.skills.filter((s) => s.origin === "own").length;
  const attention = checks.filter((c) => c.tone !== "ok");
  const kinds = (Object.keys(KIND_LABEL) as NodeKind[]).map((k) => ({ label: KIND_LABEL[k], value: graph.nodes.filter((n) => n.kind === k).length, color: KIND_COLOR[k] }));
  const top = [...degree.entries()]
    .map(([id, d]) => ({ id, total: d.in + d.out, in: d.in, out: d.out, node: graph.nodes.find((n) => n.id === id)! }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
  const last = brain.commits[0];

  return (
    <>
      <div className="topline">
        <div>
          <h1>Overview</h1>
          <p className="muted">What the brain contains right now, and what needs a person.</p>
        </div>
        <div className="meta">
          <span>
            branch <code>{brain.branch}</code>
          </span>
          {last ? (
            <span>
              last change {ago(last.date)} · <a href={last.url}>{last.sha.slice(0, 7)}</a>
            </span>
          ) : null}
          <span>read {new Date(brain.readAt).toISOString().replace("T", " ").slice(0, 16)} UTC</span>
        </div>
      </div>

      <div className="tiles">
        <Tile label="Skills" value={brain.skills.length} sub={`${own} own · ${brain.skills.length - own} vendored`} href="/skills" />
        <Tile label="Specialists" value={brain.agents.length} href="/agents" />
        <Tile label="Commands" value={brain.commands.length} href="/commands" />
        <Tile label="MCP servers" value={brain.mcpServers.length} sub={brain.mcpServers.map((m) => m.name).join(", ")} href="/tools" />
        <Tile label="Scripts" value={brain.scripts.length} href="/tools" />
        <Tile label="Projects remembered" value={brain.repoNotes.length} sub={`${brain.repoNotes.reduce((n, r) => n + r.gotchas, 0)} lessons recorded`} href="/repos" />
        <Tile label="Designs" value={brain.designs.length} href="/designs" />
        <Tile label="Files in repo" value={brain.fileCount} href="/status" />
      </div>

      <div className="grid-2">
        <Card title={attention.length ? `Needs attention (${attention.length})` : "All clear"} aside={<Link href="/status" className="small">Repo status</Link>}>
          <ul className="checks">
            {checks.map((c) => (
              <li key={c.title}>
                <span className={`dot ${c.tone}`} aria-label={c.tone} />
                <div>
                  <b dangerouslySetInnerHTML={{ __html: escape(c.title).replace(/`([^`]+)`/g, "<code>$1</code>") }} />
                  <p>
                    {c.detail} {c.href ? <Link href={c.href}>Open</Link> : null}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="What the brain is made of" aside={<Link href="/graph" className="small">See the map</Link>}>
            <Bars rows={kinds} />
            <p className="small muted">
              {graph.nodes.length} pieces, {graph.edges.length} links between them. A link means one file names another.
            </p>
          </Card>
          <Card title="Most connected pieces">
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Piece</th>
                    <th>Kind</th>
                    <th className="num">Points at</th>
                    <th className="num">Pointed at</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <Link href={t.node.href} className="mono">
                          {t.node.label}
                        </Link>
                      </td>
                      <td className="small muted">{KIND_LABEL[t.node.kind]}</td>
                      <td className="num">{t.out}</td>
                      <td className="num">{t.in}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid-2">
        <Card title="Recent changes to the brain" aside={<Link href="/status" className="small">All</Link>}>
          <ul className="commits">
            {brain.commits.slice(0, 8).map((c) => (
              <li key={c.sha}>
                <time dateTime={c.date}>{c.date.slice(0, 10)}</time>
                <span>
                  <a href={c.url}>{c.title}</a> <span className="muted small">by {c.author}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="How work flows" aside={<Link href="/how" className="small">Full route</Link>}>
          <p className="muted">
            Every session starts by reading <Link href="/manual">CLAUDE.md</Link>. It sizes the task, then pulls in skills, specialists and tools stage by stage: understand, learn the repo, research, design, build, verify, review, ship.
          </p>
          <div className="chips">
            {brain.skills
              .filter((s) => s.origin === "own")
              .map((s) => (
                <Link key={s.name} href={`/skills/${s.name}`} className="chip">
                  <span className="sw" style={{ background: KIND_COLOR.skill }} aria-hidden />
                  {s.name}
                </Link>
              ))}
          </div>
          <p className="small muted">
            Vendored pack: {brain.vendoredFrom ? <Pill tone="info">{brain.vendoredFrom.repo} @ {brain.vendoredFrom.ref}</Pill> : "none"}
          </p>
        </Card>
      </div>
    </>
  );
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
