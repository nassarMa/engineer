import { ForceGraph } from "@/components/force-graph";
import { getBrain } from "@/lib/brain";

export const revalidate = 300;
export const metadata = { title: "Map of links" };

export default async function GraphPage({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  const { graph, degree } = await getBrain();
  const { focus } = await searchParams;
  const deg = Object.fromEntries([...degree.entries()].map(([id, d]) => [id, d.in + d.out]));
  return (
    <>
      <div className="topline">
        <div>
          <h1>Map of links</h1>
          <p className="muted">Every piece of the brain and which other pieces it names. Built from the files themselves.</p>
        </div>
      </div>
      <ForceGraph graph={graph} degree={deg} initial={focus} />
    </>
  );
}
