import Link from "next/link";
import { Card, Pill } from "@/components/ui";
import { getBrain } from "@/lib/brain";

export const revalidate = 300;
export const metadata = { title: "Projects" };

export default async function ReposPage() {
  const { brain } = await getBrain();
  const now = new Date(brain.readAt).getTime();
  return (
    <>
      <div className="topline">
        <div>
          <h1>Projects the brain remembers</h1>
          <p className="muted">One notes file per repository, written by the onboard-repo skill: commands, architecture, conventions and the lessons learned (&quot;gotchas&quot;).</p>
        </div>
      </div>
      <Card>
        <div className="scroll">
          <table>
            <thead><tr><th>Repository</th><th>Purpose</th><th>Notes written</th><th className="num">Lessons</th></tr></thead>
            <tbody>
              {brain.repoNotes.map((r) => {
                const age = r.onboarded ? Math.floor((now - new Date(r.onboarded).getTime()) / 86_400_000) : null;
                return (
                  <tr key={r.name}>
                    <td><Link href={`/repos/${r.name}`}>{r.title}</Link></td>
                    <td className="small">{r.purpose}</td>
                    <td className="small">{r.onboarded ? <Pill tone={age! > 45 ? "warn" : "ok"}>{r.onboarded}</Pill> : <span className="muted">no date</span>}</td>
                    <td className="num">{r.gotchas}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
