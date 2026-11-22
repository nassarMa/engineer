import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { parseCommitFeed, type RepoReading } from "@/lib/github";
import { buildGraph } from "@/lib/graph";
import { runChecks } from "@/lib/health";
import { renderMarkdown, routeFor } from "@/lib/markdown";
import { buildBrain, mentions, splitFrontMatter } from "@/lib/model";
import { buildStages } from "@/lib/stages";
import { readTarGz } from "@/lib/tar";

/** A minimal tar archive, the way GitHub builds one (top folder, ustar headers). */
function tar(files: Record<string, string>): Uint8Array {
  const blocks: Buffer[] = [];
  for (const [name, content] of Object.entries(files)) {
    const body = Buffer.from(content);
    const header = Buffer.alloc(512);
    header.write(`repo-abc/${name}`, 0, 100);
    header.write("0000644\0", 100, 8);
    header.write(body.length.toString(8).padStart(11, "0") + "\0", 124, 12);
    header.write("0", 156, 1);
    header.write("ustar\0", 257, 6);
    header.write("00", 263, 2);
    header.write("        ", 148, 8);
    const sum = header.reduce((n, b) => n + b, 0);
    header.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8);
    blocks.push(header, body, Buffer.alloc(Math.ceil(body.length / 512) * 512 - body.length));
  }
  blocks.push(Buffer.alloc(1024));
  return new Uint8Array(gzipSync(Buffer.concat(blocks)));
}

const sample: Record<string, string> = {
  "CLAUDE.md": "# Engineer\n\n## How to work\n1. Understand.\n2. Pick the size.\n   - Small fix: do it.\n   - Feature: use the `implement-task` skill.\n\nUse `code-reviewer` before merge and `scripts/vercel.sh` to deploy.\n\n## Engineering standards\n- Tests.\n",
  "README.md": "# Engineer\n",
  ".claude/agents/architect.md": "---\nname: architect\ndescription: Designs things.\ntools: Read, Grep\n---\nFollow definition-of-done.\n",
  ".claude/agents/code-reviewer.md": "---\nname: code-reviewer\ndescription: Reviews.\n---\nUse security-and-hardening.\n",
  ".claude/skills/implement-task/SKILL.md": "---\nname: implement-task\ndescription: Build it.\n---\n# Implement\nRun `code-reviewer`, then `/ship`. See test-driven-development.\n",
  ".claude/skills/test-driven-development/SKILL.md": "---\nname: test-driven-development\ndescription: Red green refactor.\n---\nBody.\n",
  ".claude/skills/security-and-hardening/SKILL.md": "---\nname: security-and-hardening\ndescription: Harden.\n---\nBody.\n",
  ".claude/skills/browser-testing-with-devtools/SKILL.md": "---\nname: browser-testing-with-devtools\ndescription: Needs chrome-devtools MCP server.\n---\nConfigure the chrome-devtools MCP server first.\n",
  ".claude/commands/ship.md": "---\ndescription: Ship it\n---\nRun code-reviewer and security-and-hardening.\n",
  ".claude/references/definition-of-done.md": "# Definition of Done\n\nThe bar.\n",
  ".claude/agent-skills.manifest": ".claude/skills/test-driven-development\n.claude/skills/security-and-hardening\n.claude/skills/browser-testing-with-devtools\n.claude/agents/code-reviewer.md\n",
  ".claude/settings.json": JSON.stringify({ permissions: { allow: ["Bash(ls:*)"], deny: ["Bash(git push --force:*)"] } }),
  ".mcp.json": JSON.stringify({ mcpServers: { exa: { type: "http", url: "https://mcp.exa.ai/mcp" }, playwright: { command: "bash", args: ["scripts/playwright-mcp.sh"] } } }),
  "scripts/playwright-mcp.sh": "#!/usr/bin/env bash\n# Launch the Playwright MCP server. Headless.\nset -e\n",
  "scripts/vercel.sh": "#!/usr/bin/env bash\n# Run the Vercel CLI with the token from the environment.\n",
  "scripts/sync-agent-skills.sh": '#!/usr/bin/env bash\nREPO="https://github.com/addyosmani/agent-skills"\nREF="${1:-aeac41d}"   # v0.6.13, 2026-10-13\n',
  "docs/repos/README.md": "| owner/one | [notes](owner-one.md) |\n",
  "docs/repos/owner-one.md": "# owner/one\n\n- **Purpose:** A thing.\n- **Last onboarded:** 2026-10-01\n\n## Commands\n\n## Gotchas\n- first\n- second\n",
  "docs/designs/README.md": "# Designs\n",
  "docs/designs/2026-10-21-hub.md": "# Hub\n\n- **Status:** Live\n\n## Problem\n",
  "templates/design-doc.md": "# <Title>\n",
};

const reading = (): RepoReading => ({
  repo: "owner/engineer",
  branch: "work",
  files: readTarGz(tar(sample)),
  commits: [{ sha: "abc", title: "t", author: "a", date: "2026-11-01T00:00:00Z", url: "" }],
  branches: [
    { name: "work", sha: "1", ahead: 0, behind: 0 },
    { name: "other", sha: "2", ahead: 3, behind: 3 },
  ],
  apiNote: null,
  readAt: "2026-11-22T00:00:00Z",
});

describe("tar reader", () => {
  it("returns every regular file with the top folder removed", () => {
    const files = readTarGz(tar(sample));
    expect(files.size).toBe(Object.keys(sample).length);
    expect(files.get("CLAUDE.md")).toContain("# Engineer");
    expect(files.get(".claude/skills/implement-task/SKILL.md")).toContain("Implement");
  });
});

describe("front matter and mentions", () => {
  it("reads key: value lines and keeps the body", () => {
    const { meta, body } = splitFrontMatter("---\nname: x\ndescription: Does y: with colons\n---\nBody\n");
    expect(meta).toEqual({ name: "x", description: "Does y: with colons" });
    expect(body).toBe("Body\n");
  });
  it("matches whole names only", () => {
    expect(mentions("use test-driven-development and tests", ["test-driven-development", "test"])).toEqual(["test-driven-development"]);
    expect(mentions("`research` skill", ["research", "search"])).toEqual(["research"]);
  });
});

describe("brain model", () => {
  const brain = buildBrain(reading());
  it("separates own pieces from vendored ones using the manifest", () => {
    expect(brain.skills.map((s) => `${s.name}:${s.origin}`).sort()).toEqual(["browser-testing-with-devtools:vendored", "implement-task:own", "security-and-hardening:vendored", "test-driven-development:vendored"]);
    expect(brain.agents.find((a) => a.name === "code-reviewer")?.origin).toBe("vendored");
    expect(brain.agents.find((a) => a.name === "architect")?.tools).toEqual(["Read", "Grep"]);
  });
  it("reads MCP servers, scripts, permissions and the vendored pin", () => {
    expect(brain.mcpServers.map((m) => [m.name, m.transport])).toEqual([["exa", "http"], ["playwright", "stdio"]]);
    expect(brain.scripts.find((s) => s.name === "playwright-mcp.sh")?.summary).toBe("Launch the Playwright MCP server.");
    expect(brain.permissions.deny).toEqual(["Bash(git push --force:*)"]);
    expect(brain.vendoredFrom).toEqual({ repo: "addyosmani/agent-skills", ref: "aeac41d", note: "v0.6.13, 2026-10-13" });
  });
  it("reads project notes and designs", () => {
    expect(brain.repoNotes[0]).toMatchObject({ title: "owner/one", onboarded: "2026-10-01", gotchas: 2, purpose: "A thing." });
    expect(brain.designs[0]).toMatchObject({ title: "Hub", status: "Live", date: "2026-10-21" });
  });
});

describe("graph", () => {
  const brain = buildBrain(reading());
  const graph = buildGraph(brain);
  const edge = (s: string, t: string) => graph.edges.some((e) => e.source === s && e.target === t);
  it("links files by the names they mention", () => {
    expect(edge("manual:CLAUDE.md", "skill:implement-task")).toBe(true);
    expect(edge("manual:CLAUDE.md", "agent:code-reviewer")).toBe(true);
    expect(edge("manual:CLAUDE.md", "script:vercel.sh")).toBe(true);
    expect(edge("skill:implement-task", "command:ship")).toBe(true);
    expect(edge("skill:implement-task", "skill:test-driven-development")).toBe(true);
    expect(edge("agent:architect", "reference:definition-of-done")).toBe(true);
    expect(edge("mcp:playwright", "script:playwright-mcp.sh")).toBe(true);
  });
  it("never links a file to itself", () => {
    expect(graph.edges.some((e) => e.source === e.target)).toBe(false);
  });
});

describe("health checks", () => {
  const brain = buildBrain(reading());
  const checks = runChecks(brain, buildGraph(brain), new Date("2026-11-22T00:00:00Z"));
  const titles = checks.map((c) => c.title);
  it("flags a non-main default branch and unmerged branches", () => {
    expect(titles.some((t) => t.includes("default branch is `work`"))).toBe(true);
    expect(titles.some((t) => t.startsWith("1 branch with commits not in the default"))).toBe(true);
  });
  it("flags a skill that expects an undeclared MCP server, but not a passing mention", () => {
    expect(checks.some((c) => c.title.includes("implement-task"))).toBe(false);
    const check = checks.find((c) => c.title.includes("browser-testing-with-devtools"));
    expect(check?.detail).toContain("chrome-devtools");
  });
  it("flags an unlisted design and stale notes", () => {
    expect(titles.some((t) => t.includes("design not listed"))).toBe(true);
    expect(titles.some((t) => t.includes("owner/one are 52 days old"))).toBe(true);
  });
  it("puts problems before good news", () => {
    const order = checks.map((c) => c.tone);
    expect([...order].sort((a, b) => ["bad", "warn", "ok"].indexOf(a) - ["bad", "warn", "ok"].indexOf(b))).toEqual(order);
  });
});

describe("stages", () => {
  it("places skills, agents and tools on the steps of the route", () => {
    const stages = buildStages(buildBrain(reading()));
    expect(stages.find((s) => s.id === "build")?.skills).toEqual(["implement-task", "test-driven-development"]);
    expect(stages.find((s) => s.id === "review")?.agents).toEqual(["code-reviewer"]);
    expect(stages.find((s) => s.id === "ship")?.tools).toEqual(["vercel.sh"]);
  });
});

describe("markdown", () => {
  it("routes repo links to dashboard pages and the rest to GitHub, and never emits raw HTML", () => {
    const html = renderMarkdown("See [tdd](../test-driven-development/SKILL.md), [dod](../../references/definition-of-done.md), [x](../../../LICENSE) and <script>alert(1)</script>.", ".claude/skills/implement-task/SKILL.md", "work");
    expect(html).toContain('href="/skills/test-driven-development"');
    expect(html).toContain('href="/references/definition-of-done"');
    expect(html).toContain('href="https://github.com/nassarMa/engineer/blob/work/LICENSE"');
    expect(html).not.toContain("<script>");
    expect(routeFor("docs/repos/README.md")).toBeNull();
  });
});

describe("commit feed", () => {
  it("reads title, author, date and sha from GitHub's Atom feed", () => {
    const xml = `<feed><entry><id>tag:github.com,2008:Grit::Commit/abcdef</id><link type="text/html" rel="alternate" href="https://github.com/o/r/commit/abcdef"/><title>\n  Fix &amp; ship\n</title><updated>2026-11-10T15:30:37Z</updated><author><name>claude</name></author></entry></feed>`;
    expect(parseCommitFeed(xml)).toEqual([{ sha: "abcdef", title: "Fix & ship", author: "claude", date: "2026-11-10T15:30:37Z", url: "https://github.com/o/r/commit/abcdef" }]);
  });
});
