import { notFound } from "next/navigation";
import { DocPage, Neighbours } from "@/components/doc";
import { KindPill } from "@/components/ui";
import { getBrain } from "@/lib/brain";
import { neighboursOf } from "@/lib/neighbours";

export const revalidate = 300;

export default async function AgentPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const { brain, graph } = await getBrain();
  const agent = brain.agents.find((a) => a.name === name);
  if (!agent) notFound();
  const n = neighboursOf(graph, `agent:${agent.name}`);
  return (
    <DocPage
      title={agent.name}
      eyebrow={<KindPill kind="agent" />}
      path={agent.path}
      branch={brain.branch}
      source={agent.body}
      aside={
        <>
          <p className="muted">{agent.description}</p>
          <div>
            <b>May use</b>
            <p className="small">{agent.tools.length ? agent.tools.join(", ") : "all tools"}</p>
          </div>
          <Neighbours title="Pulls in" ids={n.out} labels={n.labels} />
          <Neighbours title="Called from" ids={n.in} labels={n.labels} />
        </>
      }
    />
  );
}
