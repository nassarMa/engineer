import Link from "next/link";
import { Card } from "@/components/ui";
import { getBrain } from "@/lib/brain";

export const revalidate = 300;
export const metadata = { title: "Designs" };

export default async function DesignsPage() {
  const { brain } = await getBrain();
  return (
    <>
      <div className="topline">
        <div>
          <h1>Designs</h1>
          <p className="muted">Design documents the brain produced before building. Designs that live inside a project&apos;s own repo are not listed here unless the index links them.</p>
        </div>
      </div>
      <Card>
        <ul className="list">
          {brain.designs.map((d) => (
            <li className="item" key={d.name}>
              <span className="t"><Link href={`/designs/${d.name}`}>{d.title}</Link></span>
              <span className="small muted">{d.date ?? ""}</span>
              <span className="d">Status: {d.status}</span>
            </li>
          ))}
          {!brain.designs.length ? <li className="muted">No designs yet.</li> : null}
        </ul>
      </Card>
    </>
  );
}
