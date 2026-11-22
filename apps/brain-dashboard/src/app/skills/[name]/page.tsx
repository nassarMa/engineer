import { notFound } from "next/navigation";
import { DocPage, Neighbours } from "@/components/doc";
import { KindPill } from "@/components/ui";
import { getBrain } from "@/lib/brain";
import { neighboursOf } from "@/lib/neighbours";

export const revalidate = 300;

export default async function SkillPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const { brain, graph } = await getBrain();
  const skill = brain.skills.find((s) => s.name === name);
  if (!skill) notFound();
  const n = neighboursOf(graph, `skill:${skill.name}`);
  return (
    <DocPage
      title={skill.name}
      eyebrow={<KindPill kind={skill.origin === "own" ? "skill" : "vendored-skill"} />}
      path={skill.path}
      branch={brain.branch}
      source={skill.body}
      aside={
        <>
          <p className="muted">{skill.description}</p>
          <Neighbours title="Pulls in" ids={n.out} labels={n.labels} />
          <Neighbours title="Pulled in by" ids={n.in} labels={n.labels} />
        </>
      }
    />
  );
}
