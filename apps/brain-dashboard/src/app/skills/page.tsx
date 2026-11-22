import Link from "next/link";
import { Card, KindPill } from "@/components/ui";
import { getBrain } from "@/lib/brain";

export const revalidate = 300;
export const metadata = { title: "Skills" };

export default async function SkillsPage({ searchParams }: { searchParams: Promise<{ origin?: string }> }) {
  const { brain, degree } = await getBrain();
  const { origin } = await searchParams;
  const list = brain.skills.filter((s) => !origin || s.origin === origin);
  return (
    <>
      <div className="topline">
        <div>
          <h1>Skills</h1>
          <p className="muted">A skill is a written procedure the agent loads when a task matches its description. {brain.vendoredFrom ? <>Vendored ones come from <code>{brain.vendoredFrom.repo}</code> at <code>{brain.vendoredFrom.ref}</code>.</> : null}</p>
        </div>
        <div className="filters">
          <Link href="/skills" aria-current={!origin ? "true" : undefined}>All ({brain.skills.length})</Link>
          <Link href="/skills?origin=own" aria-current={origin === "own" ? "true" : undefined}>Own ({brain.skills.filter((s) => s.origin === "own").length})</Link>
          <Link href="/skills?origin=vendored" aria-current={origin === "vendored" ? "true" : undefined}>Vendored ({brain.skills.filter((s) => s.origin === "vendored").length})</Link>
        </div>
      </div>
      <Card>
        <ul className="list">
          {list.map((s) => {
            const d = degree.get(`skill:${s.name}`);
            return (
              <li className="item" key={s.name}>
                <span className="t">
                  <Link href={`/skills/${s.name}`} className="mono">{s.name}</Link>
                  <KindPill kind={s.origin === "own" ? "skill" : "vendored-skill"} />
                </span>
                <span className="small muted">{d ? `${d.out} out · ${d.in} in` : ""} · {s.lines} lines</span>
                <span className="d">{s.description}</span>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
