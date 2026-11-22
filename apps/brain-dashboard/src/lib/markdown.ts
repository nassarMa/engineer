import MarkdownIt from "markdown-it";
import { fileUrl } from "./github";

// html: false keeps any raw HTML in the repo's markdown as text; only markdown becomes markup.
const md = new MarkdownIt({ html: false, linkify: true, typographer: false });

/** Route in this dashboard for a repo file, or null when it has none. */
export function routeFor(path: string): string | null {
  const clean = path.replace(/^\.\//, "");
  const skill = /^\.claude\/skills\/([^/]+)\/SKILL\.md$/.exec(clean);
  if (skill) return `/skills/${skill[1]}`;
  const agent = /^\.claude\/agents\/([^/]+)\.md$/.exec(clean);
  if (agent) return `/agents/${agent[1]}`;
  const command = /^\.claude\/commands\/([^/]+)\.md$/.exec(clean);
  if (command) return `/commands/${command[1]}`;
  const reference = /^\.claude\/references\/([^/]+)\.md$/.exec(clean);
  if (reference) return `/references/${reference[1]}`;
  const repo = /^docs\/repos\/([^/]+)\.md$/.exec(clean);
  if (repo && repo[1] !== "README") return `/repos/${repo[1]}`;
  const design = /^docs\/designs\/([^/]+)\.md$/.exec(clean);
  if (design && design[1] !== "README") return `/designs/${design[1]}`;
  if (clean === "CLAUDE.md" || clean === "README.md") return "/manual";
  if (clean === ".mcp.json" || clean.startsWith("scripts/")) return "/tools";
  return null;
}

/** Resolves a link written inside `fromPath` to a repo path. */
function resolve(fromPath: string, href: string): string {
  const base = fromPath.split("/").slice(0, -1);
  for (const part of href.split("/")) {
    if (part === "..") base.pop();
    else if (part !== "." && part) base.push(part);
  }
  return base.join("/");
}

export function renderMarkdown(source: string, fromPath: string, branch: string): string {
  const html = md.render(source);
  // Links to other files in the repo go to their page here, or to GitHub.
  return html.replace(/href="([^"]+)"/g, (whole, href: string) => {
    if (/^(https?:|mailto:|#)/.test(href)) return whole;
    const target = resolve(fromPath, href.split("#")[0]);
    const route = routeFor(target);
    return `href="${route ?? fileUrl(branch, target)}"`;
  });
}
