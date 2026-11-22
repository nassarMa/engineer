import { notFound } from "next/navigation";
import { DocPage, Neighbours } from "@/components/doc";
import { KindPill } from "@/components/ui";
import { getBrain } from "@/lib/brain";
import { neighboursOf } from "@/lib/neighbours";

export const revalidate = 300;

export default async function CommandPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const { brain, graph } = await getBrain();
  const command = brain.commands.find((c) => c.name === name);
  if (!command) notFound();
  const n = neighboursOf(graph, `command:${command.name}`);
  return (
    <DocPage title={`/${command.name}`} eyebrow={<KindPill kind="command" />} path={command.path} branch={brain.branch} source={command.body} aside={<><p className="muted">{command.description}</p><Neighbours title="Runs" ids={n.out} labels={n.labels} /><Neighbours title="Mentioned by" ids={n.in} labels={n.labels} /></>} />
  );
}
