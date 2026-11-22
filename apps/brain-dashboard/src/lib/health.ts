import type { Graph } from "./graph";
import type { Brain } from "./model";

export type Tone = "ok" | "warn" | "bad";
export type Check = { tone: Tone; title: string; detail: string; href?: string };

const DAY = 86_400_000;
const daysAgo = (iso: string, now: Date) => Math.floor((now.getTime() - new Date(iso).getTime()) / DAY);

/**
 * What a maintainer should know about the brain's state. Every check is
 * computed from the files themselves, so it stays true as the repo changes.
 */
export function runChecks(brain: Brain, graph: Graph, now = new Date()): Check[] {
  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);

  // Branches
  const stray = brain.branches.filter((b) => b.name !== brain.branch);
  const unmerged = stray.filter((b) => (b.ahead ?? 0) > 0);
  if (!["main", "master"].includes(brain.branch)) add({ tone: "warn", title: `The default branch is \`${brain.branch}\`, not main`, detail: "Sessions start from the default branch. A work branch as the default means the brain's history is a chain of session branches with no stable line.", href: "/status" });
  if (unmerged.length) add({ tone: "warn", title: `${unmerged.length} branch${unmerged.length > 1 ? "es" : ""} with commits not in the default branch`, detail: unmerged.map((b) => `${b.name} (+${b.ahead}/−${b.behind})`).join(", ") + ". Work done there is invisible to sessions started from the default.", href: "/status" });
  else if (brain.branches.length > 1) add({ tone: "ok", title: "Every other branch is contained in the default branch", detail: `${brain.branches.length} branches read.` });
  if (brain.apiNote) add({ tone: "warn", title: "Branch comparison is incomplete", detail: brain.apiNote, href: "/status" });

  // Activity
  const last = brain.commits[0];
  if (last) {
    const age = daysAgo(last.date, now);
    add({ tone: age > 30 ? "warn" : "ok", title: age > 30 ? `No commit for ${age} days` : `Last change ${age === 0 ? "today" : `${age} day${age > 1 ? "s" : ""} ago`}`, detail: last.title, href: last.url });
  }

  // Vendored pack
  if (brain.vendoredFrom) {
    const dateInNote = /(\d{4}-\d{2}-\d{2})/.exec(brain.vendoredFrom.note)?.[1];
    const age = dateInNote ? daysAgo(dateInNote, now) : null;
    add({
      tone: age !== null && age > 60 ? "warn" : "ok",
      title: `Vendored skills pinned to ${brain.vendoredFrom.repo}@${brain.vendoredFrom.ref}`,
      detail: age !== null ? `${brain.vendoredFrom.note}; ${age} days old. Refresh with scripts/sync-agent-skills.sh and read the diff.` : brain.vendoredFrom.note,
      href: "/skills?origin=vendored",
    });
  }

  // Skills that depend on tools the repo does not declare
  const declared = brain.mcpServers.map((m) => m.name);
  const knownServers = ["chrome-devtools", "playwright", "graphify", "exa", "github", "context7", "sentry", "linear", "slack"];
  for (const skill of brain.skills) {
    // Only a server named right beside the words "MCP server" counts; a passing mention of "github" does not.
    const needs = knownServers.filter((n) => !declared.includes(n) && new RegExp(`(\\b${n}\\b[^.\\n]{0,40}MCP server|MCP server[^.\\n]{0,40}\\b${n}\\b)`, "i").test(skill.body));
    if (needs.length) add({ tone: "warn", title: `Skill \`${skill.name}\` expects an MCP server that is not declared`, detail: `It names ${needs.join(", ")}; .mcp.json declares ${declared.join(", ") || "nothing"}.`, href: `/skills/${skill.name}` });
  }

  // Dangling references between files
  const ids = new Set(graph.nodes.map((n) => n.id));
  const dangling = graph.edges.filter((e) => !ids.has(e.target));
  if (dangling.length) add({ tone: "warn", title: `${dangling.length} references to pieces that do not exist`, detail: dangling.map((e) => `${e.source} → ${e.target}`).slice(0, 5).join("; ") });

  // Unreferenced pieces
  const referenced = new Set(graph.edges.map((e) => e.target));
  const orphans = graph.nodes.filter((n) => n.kind !== "manual" && n.kind !== "command" && !referenced.has(n.id));
  if (orphans.length) add({ tone: "warn", title: `${orphans.length} pieces nothing points at`, detail: `${orphans.map((o) => o.label).slice(0, 8).join(", ")}${orphans.length > 8 ? "…" : ""}. They load only if their own description matches a task.`, href: "/graph" });

  // Repo notes freshness
  for (const note of brain.repoNotes) {
    if (!note.onboarded) continue;
    const age = daysAgo(note.onboarded, now);
    if (age > 45) add({ tone: "warn", title: `Notes for ${note.title} are ${age} days old`, detail: "Re-run onboard-repo if the project changed since.", href: `/repos/${note.name}` });
  }
  const indexed = brain.docs.find((d) => d.path === "docs/repos/README.md") ?? null;
  const repoIndex = brain.repoNotes.length ? (brain.repoNotes.filter((n) => (indexed?.body ?? brain.readme).includes(n.name)).length) : 0;
  if (indexed && repoIndex < brain.repoNotes.length) add({ tone: "warn", title: "docs/repos/README.md does not list every notes file", detail: `${brain.repoNotes.length - repoIndex} missing.`, href: "/repos" });

  // Designs
  const designIndex = brain.docs.find((d) => d.path === "docs/designs/README.md");
  const unlisted = designIndex ? brain.designs.filter((d) => !designIndex.body.includes(d.name)) : [];
  if (unlisted.length) add({ tone: "warn", title: `${unlisted.length} design${unlisted.length > 1 ? "s" : ""} not listed in docs/designs/README.md`, detail: unlisted.map((d) => d.title).join("; "), href: "/designs" });

  // Permissions
  add({
    tone: brain.permissions.deny.some((d) => d.includes("force")) ? "ok" : "warn",
    title: brain.permissions.deny.some((d) => d.includes("force")) ? "Force-push is denied in settings.json" : "Nothing in settings.json forbids force-push",
    detail: `${brain.permissions.allow.length} commands allowed without asking, ${brain.permissions.deny.length} denied.`,
    href: "/tools",
  });

  // Secrets hygiene
  if (/(sk-|ghp_|AKIA)[A-Za-z0-9]{10,}/.test(brain.claudeMd + brain.readme)) add({ tone: "bad", title: "Something that looks like a secret is in the manual or README", detail: "Move it to an environment variable." });

  const order: Record<Tone, number> = { bad: 0, warn: 1, ok: 2 };
  return checks.sort((a, b) => order[a.tone] - order[b.tone]);
}
