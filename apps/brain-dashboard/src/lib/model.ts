import type { RepoReading } from "./github";

/** Front matter (`---` block) and the body after it. */
export function splitFrontMatter(source: string): { meta: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  if (!match) return { meta: {}, body: source };
  const meta: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx > 0) meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
  }
  return { meta, body: source.slice(match[0].length) };
}

export const firstHeading = (body: string) => /^#\s+(.+)$/m.exec(body)?.[1]?.trim() ?? null;
const firstParagraph = (body: string) =>
  body
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .find((p) => p && !p.startsWith("#") && !p.startsWith("|") && !p.startsWith("```")) ?? "";

export type Origin = "own" | "vendored";

export type Agent = { name: string; description: string; tools: string[]; origin: Origin; path: string; body: string; lines: number };
export type Skill = { name: string; description: string; origin: Origin; path: string; body: string; lines: number; references: string[] };
export type Command = { name: string; description: string; path: string; body: string };
export type Reference = { name: string; title: string; path: string; body: string; lines: number };
export type McpServer = { name: string; transport: "http" | "stdio"; target: string; env: string[]; path: string };
export type Script = { name: string; summary: string; path: string; lines: number };
export type RepoNote = { name: string; title: string; purpose: string; onboarded: string | null; gotchas: number; path: string; body: string };
export type Design = { name: string; title: string; status: string; date: string | null; path: string; body: string };
export type Doc = { name: string; title: string; path: string; body: string };

export type Brain = {
  repo: string;
  branch: string;
  readAt: string;
  claudeMd: string;
  readme: string;
  agents: Agent[];
  skills: Skill[];
  commands: Command[];
  references: Reference[];
  mcpServers: McpServer[];
  scripts: Script[];
  repoNotes: RepoNote[];
  designs: Design[];
  docs: Doc[];
  templates: Doc[];
  permissions: { allow: string[]; deny: string[] };
  vendoredFrom: { repo: string; ref: string; note: string } | null;
  fileCount: number;
  commits: RepoReading["commits"];
  branches: RepoReading["branches"];
  apiNote: string | null;
};

const lines = (s: string) => s.split("\n").length;

/** Names mentioned in a text, out of a known set. Matches whole words, `path/` forms and backticks. */
export function mentions(text: string, candidates: string[], self?: string, ignoreCase = false): string[] {
  const found: string[] = [];
  for (const name of candidates) {
    if (name === self) continue;
    const pattern = new RegExp(`(^|[^A-Za-z0-9_-])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9_-])`, ignoreCase ? "mi" : "m");
    if (pattern.test(text)) found.push(name);
  }
  return found;
}

export function buildBrain(reading: RepoReading): Brain {
  const { files } = reading;
  const get = (path: string) => files.get(path) ?? "";
  const under = (dir: string) => [...files.keys()].filter((p) => p.startsWith(`${dir}/`)).sort();

  const manifest = new Set(
    get(".claude/agent-skills.manifest")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
  );
  const vendored = (path: string) => [...manifest].some((entry) => path === entry || path.startsWith(`${entry}/`));

  const agents: Agent[] = under(".claude/agents")
    .filter((p) => p.endsWith(".md"))
    .map((path) => {
      const { meta, body } = splitFrontMatter(get(path));
      return {
        name: meta.name ?? path.split("/").pop()!.replace(/\.md$/, ""),
        description: meta.description ?? firstParagraph(body),
        tools: meta.tools ? meta.tools.split(",").map((t) => t.trim()).filter(Boolean) : [],
        origin: vendored(path) ? "vendored" : "own",
        path,
        body,
        lines: lines(body),
      };
    });

  const skillPaths = under(".claude/skills").filter((p) => /^\.claude\/skills\/[^/]+\/SKILL\.md$/.test(p));
  const skillNames = skillPaths.map((p) => p.split("/")[2]);
  const skills: Skill[] = skillPaths.map((path) => {
    const { meta, body } = splitFrontMatter(get(path));
    const dir = path.replace(/\/SKILL\.md$/, "");
    const extra = under(dir)
      .filter((p) => p !== path)
      .map((p) => get(p))
      .join("\n");
    const name = meta.name ?? path.split("/")[2];
    return {
      name,
      description: meta.description ?? firstParagraph(body),
      origin: vendored(dir) ? "vendored" : "own",
      path,
      body,
      lines: lines(body),
      references: mentions(`${body}\n${extra}`, skillNames, name),
    };
  });

  const commands: Command[] = under(".claude/commands")
    .filter((p) => p.endsWith(".md"))
    .map((path) => {
      const { meta, body } = splitFrontMatter(get(path));
      return { name: path.split("/").pop()!.replace(/\.md$/, ""), description: meta.description ?? firstParagraph(body), path, body };
    });

  const references: Reference[] = under(".claude/references")
    .filter((p) => p.endsWith(".md"))
    .map((path) => {
      const body = get(path);
      const name = path.split("/").pop()!.replace(/\.md$/, "");
      return { name, title: firstHeading(body) ?? name, path, body, lines: lines(body) };
    });

  let mcpServers: McpServer[] = [];
  try {
    const parsed = JSON.parse(get(".mcp.json") || "{}") as { mcpServers?: Record<string, { type?: string; url?: string; command?: string; args?: string[]; env?: Record<string, string> }> };
    mcpServers = Object.entries(parsed.mcpServers ?? {}).map(([name, s]) => ({
      name,
      transport: s.type === "http" ? "http" : "stdio",
      target: s.type === "http" ? (s.url ?? "") : [s.command, ...(s.args ?? [])].filter(Boolean).join(" "),
      env: Object.keys(s.env ?? {}),
      path: ".mcp.json",
    }));
  } catch {
    mcpServers = [];
  }

  const scripts: Script[] = under("scripts").map((path) => {
    const body = get(path);
    const comment = body
      .split("\n")
      .slice(1)
      .filter((l) => l.startsWith("#"))
      .map((l) => l.replace(/^#\s?/, ""));
    const summary = comment.join(" ").split(/(?<=\.)\s/)[0]?.trim() || comment[0] || "";
    return { name: path.split("/").pop()!, summary, path, lines: lines(body) };
  });

  const repoNotes: RepoNote[] = under("docs/repos")
    .filter((p) => p.endsWith(".md") && !p.endsWith("README.md"))
    .map((path) => {
      const body = get(path);
      const purpose = /\*\*Purpose:\*\*\s*([\s\S]*?)(?:\n-|\n\n)/.exec(body)?.[1]?.replace(/\s+/g, " ").trim() ?? firstParagraph(body);
      const gotchaSection = body.split(/^## Gotchas/m)[1]?.split(/^## /m)[0] ?? "";
      return {
        name: path.split("/").pop()!.replace(/\.md$/, ""),
        title: firstHeading(body) ?? path,
        purpose,
        onboarded: /\*\*Last onboarded:\*\*\s*(\d{4}-\d{2}-\d{2})/.exec(body)?.[1] ?? null,
        gotchas: (gotchaSection.match(/^- /gm) ?? []).length,
        path,
        body,
      };
    });

  const designs: Design[] = under("docs/designs")
    .filter((p) => p.endsWith(".md") && !p.endsWith("README.md"))
    .map((path) => {
      const body = get(path);
      const status = /\*\*Status:\*\*\s*([^\n]+)|^Status:\s*([^\n]+)/m.exec(body);
      return {
        name: path.split("/").pop()!.replace(/\.md$/, ""),
        title: firstHeading(body) ?? path,
        status: (status?.[1] ?? status?.[2] ?? "unknown").trim(),
        date: /(\d{4}-\d{2}-\d{2})/.exec(path)?.[1] ?? null,
        path,
        body,
      };
    });

  const docOf = (path: string): Doc => ({ name: path.split("/").pop()!.replace(/\.md$/, ""), title: firstHeading(get(path)) ?? path, path, body: get(path) });
  const docs = [...files.keys()].filter((p) => /^docs\/[^/]+\.md$/.test(p) || /^docs\/[^/]+\/README\.md$/.test(p)).sort().map(docOf);
  const templates = under("templates").map(docOf);

  let permissions = { allow: [] as string[], deny: [] as string[] };
  try {
    const settings = JSON.parse(get(".claude/settings.json") || "{}") as { permissions?: { allow?: string[]; deny?: string[] } };
    permissions = { allow: settings.permissions?.allow ?? [], deny: settings.permissions?.deny ?? [] };
  } catch {
    /* unreadable settings are reported by the health checks */
  }

  const sync = get("scripts/sync-agent-skills.sh");
  const repoMatch = /REPO="https:\/\/github\.com\/([^"]+)"/.exec(sync);
  const refMatch = /REF="\$\{1:-([^}]+)\}"\s*#?\s*(.*)/.exec(sync);
  const vendoredFrom = repoMatch ? { repo: repoMatch[1], ref: refMatch?.[1] ?? "?", note: refMatch?.[2]?.trim() ?? "" } : null;

  return {
    repo: reading.repo,
    branch: reading.branch,
    readAt: reading.readAt,
    claudeMd: get("CLAUDE.md"),
    readme: get("README.md"),
    agents,
    skills,
    commands,
    references,
    mcpServers,
    scripts,
    repoNotes,
    designs,
    docs,
    templates,
    permissions,
    vendoredFrom,
    fileCount: files.size,
    commits: reading.commits,
    branches: reading.branches,
    apiNote: reading.apiNote,
  };
}
