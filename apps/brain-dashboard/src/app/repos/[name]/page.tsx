import { notFound } from "next/navigation";
import { DocPage } from "@/components/doc";
import { getBrain } from "@/lib/brain";

export const revalidate = 300;

export default async function RepoPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const { brain } = await getBrain();
  const note = brain.repoNotes.find((r) => r.name === name);
  if (!note) notFound();
  return <DocPage title={note.title} eyebrow={<span className="pill info">Project notes</span>} path={note.path} branch={brain.branch} source={note.body} />;
}
