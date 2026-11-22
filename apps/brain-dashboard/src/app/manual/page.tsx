import { Card } from "@/components/ui";
import { getBrain } from "@/lib/brain";
import { fileUrl } from "@/lib/github";
import { renderMarkdown } from "@/lib/markdown";

export const revalidate = 300;
export const metadata = { title: "Manual" };

export default async function ManualPage() {
  const { brain } = await getBrain();
  return (
    <>
      <div className="topline">
        <div>
          <h1>The operating manual</h1>
          <p className="muted">CLAUDE.md is the only file read at the start of every session. Everything else is loaded from here.</p>
        </div>
      </div>
      <Card title="CLAUDE.md" aside={<a href={fileUrl(brain.branch, "CLAUDE.md")} className="small">GitHub</a>}>
        <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(brain.claudeMd, "CLAUDE.md", brain.branch) }} />
      </Card>
      <Card title="README.md" aside={<a href={fileUrl(brain.branch, "README.md")} className="small">GitHub</a>}>
        <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(brain.readme, "README.md", brain.branch) }} />
      </Card>
      {brain.templates.map((t) => (
        <Card key={t.path} title={`Template: ${t.title}`} aside={<a href={fileUrl(brain.branch, t.path)} className="small">GitHub</a>}>
          <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(t.body, t.path, brain.branch) }} />
        </Card>
      ))}
    </>
  );
}
