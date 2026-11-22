import { notFound } from "next/navigation";
import { DocPage } from "@/components/doc";
import { getBrain } from "@/lib/brain";

export const revalidate = 300;

export default async function DesignPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const { brain } = await getBrain();
  const design = brain.designs.find((d) => d.name === name);
  if (!design) notFound();
  return <DocPage title={design.title} eyebrow={<span className="pill info">Design</span>} path={design.path} branch={brain.branch} source={design.body} />;
}
