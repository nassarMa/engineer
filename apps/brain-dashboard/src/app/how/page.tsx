import Link from "next/link";
import { Card, Chip, KIND_COLOR } from "@/components/ui";
import { getBrain } from "@/lib/brain";
import { buildStages, unplaced } from "@/lib/stages";

export const revalidate = 300;
export const metadata = { title: "How it works" };

export default async function HowPage() {
  const { brain } = await getBrain();
  const stages = buildStages(brain);
  const rest = unplaced(brain, stages);
  const sizing = /## How to work([\s\S]*?)(?=\n## )/.exec(brain.claudeMd)?.[1] ?? "";
  const sizeLines = sizingBullets(sizing);

  return (
    <>
      <div className="topline">
        <div>
          <h1>How a project moves through the brain</h1>
          <p className="muted">The stages come from CLAUDE.md. Which pieces attach to each stage is read from the repo, so this page changes when the repo does.</p>
        </div>
      </div>

      <Card title="Step 0: size the task">
        <p className="muted">The manual&apos;s own rule for choosing how much process a task gets:</p>
        <ul style={{ margin: 0, paddingInlineStart: "1.2em", display: "flex", flexDirection: "column", gap: 6 }}>
          {sizeLines.length ? sizeLines.map((l) => <li key={l} dangerouslySetInnerHTML={{ __html: escape(l).replace(/`([^`]+)`/g, "<code>$1</code>") }} />) : <li className="muted">No sizing rules found under “How to work” in CLAUDE.md.</li>}
        </ul>
      </Card>

      <div className="stages">
        {stages.map((s, i) => (
          <div className="stage" data-n={i + 1} key={s.id}>
            <div className="box">
              <div>
                <h2>{s.title}</h2>
                <p className="muted">{s.question}</p>
              </div>
              <Row label="Skills" items={s.skills.map((n) => ({ href: `/skills/${n}`, kind: brain.skills.find((x) => x.name === n)?.origin === "own" ? "skill" : "vendored-skill", label: n }) as const)} empty="none" />
              <Row label="Specialists" items={s.agents.map((n) => ({ href: `/agents/${n}`, kind: "agent", label: n }) as const)} empty="the main agent does it" />
              <Row label="Tools" items={s.tools.map((n) => ({ href: "/tools", kind: brain.mcpServers.some((m) => m.name === n) ? "mcp" : "script", label: n }) as const)} empty="file tools and shell only" />
              <Row label="Commands" items={s.commands.map((n) => ({ href: `/commands/${n}`, kind: "command", label: `/${n}` }) as const)} empty="—" />
            </div>
          </div>
        ))}
      </div>

      {rest.length ? (
        <Card title="Skills used at any stage">
          <p className="muted small">Not tied to one step; the agent loads them when a task matches their description.</p>
          <div className="chips">
            {rest.map((n) => (
              <Chip key={n} href={`/skills/${n}`} kind={brain.skills.find((x) => x.name === n)?.origin === "own" ? "skill" : "vendored-skill"}>
                {n}
              </Chip>
            ))}
          </div>
        </Card>
      ) : null}

      <Card title="Rules that hold at every stage">
        <ul style={{ margin: 0, paddingInlineStart: "1.2em", display: "flex", flexDirection: "column", gap: 6 }} className="muted">
          <li>Specialists run alone and report back; they do not call each other. Independent ones run in parallel.</li>
          <li>Nothing is claimed to work unless it was run. Failures are reported with their output.</li>
          <li>Work lands on a feature branch; a pull request is opened only when asked; production deploys only when asked.</li>
          <li>
            Designs are kept in <Link href="/designs">docs/designs</Link>, and what was learned about a repo in <Link href="/repos">docs/repos</Link>.
          </li>
        </ul>
        <p className="small muted">
          These are the manual&apos;s own words, shortened. Read them in full on the <Link href="/manual">Manual</Link> page.
        </p>
      </Card>
    </>
  );
}

function Row({ label, items, empty }: { label: string; items: readonly { href: string; kind: keyof typeof KIND_COLOR; label: string }[]; empty: string }) {
  return (
    <div className="row">
      <span className="k">{label}</span>
      {items.length ? (
        <div className="chips">
          {items.map((i) => (
            <Chip key={i.label} href={i.href} kind={i.kind}>
              {i.label}
            </Chip>
          ))}
        </div>
      ) : (
        <span className="muted" style={{ paddingTop: 4 }}>
          {empty}
        </span>
      )}
    </div>
  );
}

/** The indented bullets under "Pick the right size of process", with wrapped lines joined. */
function sizingBullets(section: string): string[] {
  const out: string[] = [];
  for (const line of section.split("\n")) {
    if (/^\s{2,}- /.test(line)) out.push(line.trim().replace(/^- /, ""));
    else if (out.length && /^\s{4,}\S/.test(line) && !/^\s*\d+\./.test(line)) out[out.length - 1] += ` ${line.trim()}`;
    else if (/^\d+\.|^\S/.test(line) && out.length) break;
  }
  return out.map((l) => l.replace(/\*\*/g, ""));
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
