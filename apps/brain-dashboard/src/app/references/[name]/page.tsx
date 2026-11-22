import { notFound } from "next/navigation";
import { DocPage, Neighbours } from "@/components/doc";
import { KindPill } from "@/components/ui";
import { getBrain } from "@/lib/brain";
import { neighboursOf } from "@/lib/neighbours";

export const revalidate = 300;

export default async function ReferencePage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const { brain, graph } = await getBrain();
  const ref = brain.references.find((r) => r.name === name);
  if (!ref) notFound();
  const n = neighboursOf(graph, `reference:${ref.name}`);
  return <DocPage title={ref.title} eyebrow={<KindPill kind="reference" />} path={ref.path} branch={brain.branch} source={ref.body} aside={<><Neighbours title="Points at" ids={n.out} labels={n.labels} /><Neighbours title="Used by" ids={n.in} labels={n.labels} /></>} />;
}
