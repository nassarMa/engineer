import { Card, Pill } from "@/components/ui";
import { getBrain } from "@/lib/brain";
import { REPO } from "@/lib/github";

export const revalidate = 300;
export const metadata = { title: "Repo status" };

export default async function StatusPage() {
  const { brain } = await getBrain();
  // Commits per week over the last 12 weeks, from the feed (which holds the latest 20).
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const end = new Date(new Date(brain.readAt).getTime() - i * 7 * 86_400_000);
    const start = new Date(end.getTime() - 7 * 86_400_000);
    return { label: start.toISOString().slice(5, 10), n: brain.commits.filter((c) => new Date(c.date) >= start && new Date(c.date) < end).length };
  }).reverse();
  const max = Math.max(...weeks.map((w) => w.n), 1);
  return (
    <>
      <div className="topline">
        <div>
          <h1>Repository status</h1>
          <p className="muted">
            <a href={`https://github.com/${REPO}`}>{REPO}</a>, read at {new Date(brain.readAt).toISOString().replace("T", " ").slice(0, 16)} UTC.
          </p>
        </div>
      </div>
      <div className="grid-2">
        <Card title="Branches">
          {brain.branches.length ? (
            <div className="scroll">
              <table>
                <thead><tr><th>Branch</th><th className="num">Ahead</th><th className="num">Behind</th><th>Last commit</th></tr></thead>
                <tbody>
                  {brain.branches.map((b) => (
                    <tr key={b.name}>
                      <td><span className="mono">{b.name}</span> {b.name === brain.branch ? <Pill tone="info">default</Pill> : null}</td>
                      <td className="num">{b.ahead ?? "?"}</td>
                      <td className="num">{b.behind ?? "?"}</td>
                      <td className="small muted">{b.lastCommit?.slice(0, 10) ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="note warn">{brain.apiNote ?? "No branch information."} Set <code>GITHUB_TOKEN</code> on the deployment (a fine-grained token with read access to this public repo is enough) to see every branch and how far it is from the default.</p>
          )}
          <p className="small muted">Ahead = commits only on that branch. Behind = commits on the default branch it does not have.</p>
        </Card>
        <Card title="Commits per week (latest 20 commits)">
          <div className="week-bars" role="img" aria-label={`Commits per week: ${weeks.map((w) => `${w.label}: ${w.n}`).join(", ")}`}>
            {weeks.map((w) => (
              <div key={w.label} style={{ height: `${(w.n / max) * 100}%` }} title={`${w.label}: ${w.n}`}>
                {w.n ? <span>{w.n}</span> : null}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }} className="small muted"><span>{weeks[0].label}</span><span>{weeks.at(-1)!.label}</span></div>
        </Card>
      </div>
      <Card title="Latest commits">
        <ul className="commits">
          {brain.commits.map((c) => (
            <li key={c.sha}>
              <time dateTime={c.date}>{c.date.slice(0, 10)}</time>
              <span><a href={c.url}>{c.title}</a> <span className="muted small">{c.sha.slice(0, 7)} · {c.author}</span></span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
