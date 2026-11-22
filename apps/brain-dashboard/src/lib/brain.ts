import { cache } from "react";
import { readRepo } from "./github";
import { buildGraph, degrees, type Graph } from "./graph";
import { runChecks, type Check } from "./health";
import { buildBrain, type Brain } from "./model";

export type Loaded = { brain: Brain; graph: Graph; degree: ReturnType<typeof degrees>; checks: Check[] };

/** One reading per request; the fetches underneath are cached across requests by Next. */
export const getBrain = cache(async (): Promise<Loaded> => {
  const brain = buildBrain(await readRepo());
  const graph = buildGraph(brain);
  return { brain, graph, degree: degrees(graph), checks: runChecks(brain, graph) };
});
