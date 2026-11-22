import { readTarGz } from "./tar";

export const REPO = process.env.BRAIN_REPO?.trim() || "nassarMa/engineer";
const FALLBACK_BRANCH = process.env.BRAIN_BRANCH?.trim() || "claude/trusting-hopper-x4ljjn";
/** How long a reading of the repo is reused before it is fetched again. */
export const REVALIDATE_SECONDS = 300;

const headers: Record<string, string> = { "user-agent": "engineer-brain-dashboard" };
const token = process.env.GITHUB_TOKEN?.trim();
const apiHeaders: Record<string, string> = token ? { ...headers, authorization: `Bearer ${token}`, accept: "application/vnd.github+json" } : { ...headers, accept: "application/vnd.github+json" };

export type Commit = { sha: string; title: string; author: string; date: string; url: string };
export type Branch = { name: string; sha: string; ahead?: number; behind?: number; lastCommit?: string };

export type RepoReading = {
  repo: string;
  branch: string;
  files: Map<string, string>;
  commits: Commit[];
  branches: Branch[];
  /** Why branch details are missing, if they are. */
  apiNote: string | null;
  readAt: string;
};

async function defaultBranch(): Promise<{ branch: string; note: string | null }> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}`, { headers: apiHeaders, next: { revalidate: 3600 } });
    if (res.ok) return { branch: ((await res.json()) as { default_branch: string }).default_branch, note: null };
    return { branch: FALLBACK_BRANCH, note: `GitHub API answered ${res.status} for the repository; showing the configured branch.` };
  } catch (error) {
    return { branch: FALLBACK_BRANCH, note: `GitHub API unreachable (${(error as Error).message}); showing the configured branch.` };
  }
}

/** The whole branch in one request: GitHub's archive download is not subject to the API rate limit. */
async function fetchFiles(branch: string): Promise<Map<string, string>> {
  const res = await fetch(`https://codeload.github.com/${REPO}/tar.gz/refs/heads/${branch}`, { headers, next: { revalidate: REVALIDATE_SECONDS } });
  if (!res.ok) throw new Error(`Could not download ${REPO}@${branch}: HTTP ${res.status}`);
  return readTarGz(new Uint8Array(await res.arrayBuffer()));
}

/** Recent commits from the public Atom feed (no API key, no rate limit). */
export async function fetchCommits(branch: string): Promise<Commit[]> {
  const res = await fetch(`https://github.com/${REPO}/commits/${branch}.atom`, { headers, next: { revalidate: REVALIDATE_SECONDS } });
  if (!res.ok) return [];
  return parseCommitFeed(await res.text());
}

export function parseCommitFeed(xml: string): Commit[] {
  const entries = xml.split("<entry>").slice(1);
  const text = (entry: string, tag: string) => {
    const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(entry);
    return match ? decode(match[1].trim()) : "";
  };
  return entries.map((entry) => {
    const link = /<link[^>]*href="([^"]+)"/.exec(entry)?.[1] ?? "";
    return {
      sha: link.split("/").pop() ?? "",
      title: text(entry, "title"),
      author: decode(/<author>\s*<name>([^<]*)<\/name>/.exec(entry)?.[1] ?? ""),
      date: text(entry, "updated"),
      url: link,
    };
  });
}

const decode = (value: string) => value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

/** Branch list and how far each is from the default branch. Needs the API; degrades to nothing. */
async function fetchBranches(defaultName: string): Promise<{ branches: Branch[]; note: string | null }> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/branches?per_page=50`, { headers: apiHeaders, next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) return { branches: [], note: `Branch comparison unavailable: GitHub API answered ${res.status}${token ? "" : " (no GITHUB_TOKEN set, anonymous limit is 60 requests an hour)"}.` };
    const list = (await res.json()) as { name: string; commit: { sha: string } }[];
    const branches = await Promise.all(
      list.map(async (b): Promise<Branch> => {
        if (b.name === defaultName) return { name: b.name, sha: b.commit.sha, ahead: 0, behind: 0 };
        const cmp = await fetch(`https://api.github.com/repos/${REPO}/compare/${encodeURIComponent(defaultName)}...${encodeURIComponent(b.name)}`, { headers: apiHeaders, next: { revalidate: REVALIDATE_SECONDS } });
        if (!cmp.ok) return { name: b.name, sha: b.commit.sha };
        const data = (await cmp.json()) as { ahead_by: number; behind_by: number; commits: { commit: { committer: { date: string } } }[] };
        return { name: b.name, sha: b.commit.sha, ahead: data.ahead_by, behind: data.behind_by, lastCommit: data.commits.at(-1)?.commit.committer.date };
      }),
    );
    return { branches, note: null };
  } catch (error) {
    return { branches: [], note: `Branch comparison unavailable: ${(error as Error).message}` };
  }
}

export async function readRepo(): Promise<RepoReading> {
  const { branch, note } = await defaultBranch();
  const [files, commits, branchInfo] = await Promise.all([fetchFiles(branch), fetchCommits(branch), fetchBranches(branch)]);
  return { repo: REPO, branch, files, commits, branches: branchInfo.branches, apiNote: note ?? branchInfo.note, readAt: new Date().toISOString() };
}

export const fileUrl = (branch: string, path: string) => `https://github.com/${REPO}/blob/${branch}/${path}`;
