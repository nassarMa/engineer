import Link from "next/link";
import { Card, KindPill } from "@/components/ui";
import { getBrain } from "@/lib/brain";

export const revalidate = 300;
export const metadata = { title: "Specialists" };

export default async function AgentsPage() {
  const { brain, degree } = await getBrain();
  return (
    <>
      <div className="topline">
        <div>
          <h1>Specialists</h1>
          <p className="muted">A specialist is a second Claude with its own instructions and a limited set of tools. It works alone and returns a report; specialists never call each other.</p>
        </div>
      </div>
      <Card>
        <div className="scroll">
          <table>
            <thead>
              <tr><th>Name</th><th>Does</th><th>May use</th><th>Origin</th><th className="num">Links</th></tr>
            </thead>
            <tbody>
              {brain.agents.map((a) => {
                const d = degree.get(`agent:${a.name}`);
                return (
                  <tr key={a.name}>
                    <td><Link href={`/agents/${a.name}`} className="mono">{a.name}</Link></td>
                    <td>{a.description}</td>
                    <td className="small">{a.tools.length ? a.tools.map((t) => <code key={t} style={{ marginInlineEnd: 4 }}>{t}</code>) : <span className="muted">all tools</span>}</td>
                    <td><KindPill kind={a.origin === "own" ? "skill" : "vendored-skill"} /></td>
                    <td className="num">{d ? d.in + d.out : 0}</td>
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
