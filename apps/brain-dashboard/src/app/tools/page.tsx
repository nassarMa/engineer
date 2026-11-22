import Link from "next/link";
import { Card, KindPill } from "@/components/ui";
import { getBrain } from "@/lib/brain";
import { fileUrl } from "@/lib/github";
import { renderMarkdown } from "@/lib/markdown";

export const revalidate = 300;
export const metadata = { title: "Tools and MCP" };

export default async function ToolsPage() {
  const { brain, graph } = await getBrain();
  const usedBy = (id: string) => graph.edges.filter((e) => e.target === id).map((e) => graph.nodes.find((n) => n.id === e.source)!).filter(Boolean);
  const connecting = brain.docs.find((d) => d.path === "docs/connecting-tools.md");
  return (
    <>
      <div className="topline">
        <div>
          <h1>Tools and MCP servers</h1>
          <p className="muted">An MCP server is a plug that gives the agent a new tool. These are the ones declared in <code>.mcp.json</code>; they load only when a session starts inside this repo. Connectors on the claude.ai account (GitHub and others) are not listed here because they are not in the repo.</p>
        </div>
      </div>
      <Card title="MCP servers">
        <div className="scroll">
          <table>
            <thead><tr><th>Name</th><th>How it runs</th><th>Needs</th><th>Used by</th></tr></thead>
            <tbody>
              {brain.mcpServers.map((m) => (
                <tr key={m.name}>
                  <td><span className="mono">{m.name}</span> <KindPill kind="mcp" /></td>
                  <td className="small"><span className="pill info">{m.transport}</span> <code>{m.target}</code></td>
                  <td className="small">{m.env.length ? m.env.map((e) => <code key={e}>{e}</code>) : <span className="muted">nothing</span>}</td>
                  <td className="small">{usedBy(`mcp:${m.name}`).map((n) => <Link key={n.id} href={n.href} className="mono" style={{ marginInlineEnd: 8 }}>{n.label}</Link>) || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Scripts">
        <div className="scroll">
          <table>
            <thead><tr><th>Script</th><th>Does</th><th>Used by</th></tr></thead>
            <tbody>
              {brain.scripts.map((s) => (
                <tr key={s.name}>
                  <td><a href={fileUrl(brain.branch, s.path)} className="mono">{s.name}</a></td>
                  <td>{s.summary}</td>
                  <td className="small">{usedBy(`script:${s.name}`).map((n) => <Link key={n.id} href={n.href} className="mono" style={{ marginInlineEnd: 8 }}>{n.label}</Link>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="grid-2">
        <Card title="Allowed without asking">
          <ul style={{ margin: 0, paddingInlineStart: "1.2em" }}>{brain.permissions.allow.map((p) => <li key={p}><code>{p}</code></li>)}</ul>
          <p className="small muted">From <code>.claude/settings.json</code>. Everything else prompts, unless the session&apos;s own mode allows it.</p>
        </Card>
        <Card title="Always denied">
          <ul style={{ margin: 0, paddingInlineStart: "1.2em" }}>{brain.permissions.deny.map((p) => <li key={p}><code>{p}</code></li>)}</ul>
        </Card>
      </div>
      {connecting ? (
        <Card title={connecting.title} aside={<a href={fileUrl(brain.branch, connecting.path)} className="small">GitHub</a>}>
          <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(connecting.body, connecting.path, brain.branch) }} />
        </Card>
      ) : null}
    </>
  );
}
