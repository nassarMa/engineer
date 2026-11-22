import type { Brain } from "./model";

/**
 * The route a project takes through the brain, as CLAUDE.md describes it.
 * The stages are the manual's own steps; which pieces attach to each stage is
 * read from the repo, so a new skill shows up where its name says it belongs.
 */
export type Stage = { id: string; title: string; question: string; skills: string[]; agents: string[]; tools: string[]; commands: string[] };

const PLAN: { id: string; title: string; question: string; skills: RegExp; agents: RegExp; tools: RegExp; commands: RegExp }[] = [
  { id: "understand", title: "Understand", question: "What is really being asked, and what is unknown?", skills: /interview-me|idea-refine|spec-driven|context-engineering/, agents: /^$/, tools: /^$/, commands: /^spec$/ },
  { id: "learn", title: "Learn the repo", question: "How is this codebase built, run and tested?", skills: /onboard-repo|codebase-graph/, agents: /^$/, tools: /graphify|github/i, commands: /^$/ },
  { id: "research", title: "Research", question: "What do the docs and other people say?", skills: /^research$|source-driven/, agents: /researcher/, tools: /exa/i, commands: /^$/ },
  { id: "design", title: "Design", question: "Which approach, and why not the others?", skills: /design-solution|api-and-interface|planning-and-task|documentation-and-adrs|doubt-driven/, agents: /architect/, tools: /^$/, commands: /^plan$/ },
  { id: "build", title: "Build", question: "One tested slice at a time.", skills: /implement-task|incremental|test-driven|frontend-ui|constraint-driven/, agents: /implementer/, tools: /^$/, commands: /^build$|^test$|^constraints$/ },
  { id: "verify", title: "Verify", question: "Does it really work? Show the output.", skills: /debugging|browser-testing|observability/, agents: /test-engineer/, tools: /playwright/i, commands: /^test$/ },
  { id: "review", title: "Review", question: "Correct, readable, secure, fast?", skills: /code-review|code-simplification|security-and-hardening|performance-optimization/, agents: /code-reviewer|security-auditor|web-performance/, tools: /^$/, commands: /^review$|^code-simplify$|^webperf$/ },
  { id: "ship", title: "Ship", question: "Commit, push, preview, and only then production.", skills: /git-workflow|ci-cd|shipping-and-launch|deploy-vercel|deprecation/, agents: /^$/, tools: /vercel/i, commands: /^ship$/ },
];

export function buildStages(brain: Brain): Stage[] {
  const tools = [...brain.mcpServers.map((m) => m.name), ...brain.scripts.map((s) => s.name)];
  return PLAN.map((p) => ({
    id: p.id,
    title: p.title,
    question: p.question,
    skills: brain.skills.map((s) => s.name).filter((n) => p.skills.test(n)),
    agents: brain.agents.map((a) => a.name).filter((n) => p.agents.test(n)),
    tools: tools.filter((n) => p.tools.test(n)),
    commands: brain.commands.map((c) => c.name).filter((n) => p.commands.test(n)),
  }));
}

/** Skills the stage plan does not place anywhere, so the page can list them instead of hiding them. */
export function unplaced(brain: Brain, stages: Stage[]): string[] {
  const placed = new Set(stages.flatMap((s) => s.skills));
  return brain.skills.map((s) => s.name).filter((n) => !placed.has(n));
}
