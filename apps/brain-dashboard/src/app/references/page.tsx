import Link from "next/link";
import { Card } from "@/components/ui";
import { getBrain } from "@/lib/brain";

export const revalidate = 300;
export const metadata = { title: "Checklists" };

export default async function ReferencesPage() {
  const { brain, degree } = await getBrain();
  return (
    <>
      <div className="topline">
        <div>
          <h1>Checklists</h1>
          <p className="muted">Shared reference material the skills point to.</p>
        </div>
      </div>
      <Card>
        <ul className="list">
          {brain.references.map((r) => {
            const d = degree.get(`reference:${r.name}`);
            return (
              <li className="item" key={r.name}>
                <span className="t"><Link href={`/references/${r.name}`}>{r.title}</Link></span>
                <span className="small muted">used by {d?.in ?? 0} · {r.lines} lines</span>
                <span className="d mono">{r.path}</span>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
