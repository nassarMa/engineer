import Link from "next/link";
import { Card } from "@/components/ui";
import { getBrain } from "@/lib/brain";

export const revalidate = 300;
export const metadata = { title: "Commands" };

export default async function CommandsPage() {
  const { brain } = await getBrain();
  return (
    <>
      <div className="topline">
        <div>
          <h1>Commands</h1>
          <p className="muted">Workflows you start yourself by typing the name in a session. Each one invokes skills and specialists listed on its page.</p>
        </div>
      </div>
      <Card>
        <ul className="list">
          {brain.commands.map((c) => (
            <li className="item" key={c.name}>
              <span className="t"><Link href={`/commands/${c.name}`} className="mono">/{c.name}</Link></span>
              <span />
              <span className="d">{c.description}</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
