import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Nav } from "@/components/nav";
import { getBrain } from "@/lib/brain";
import { REVALIDATE_SECONDS } from "@/lib/github";
import "./globals.css";

export const metadata: Metadata = { title: { default: "Engineer Brain", template: "%s · Engineer Brain" }, description: "What the engineer agent repo contains and how it works, read live from GitHub." };
export const revalidate = 300;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { brain, checks } = await getBrain();
  const attention = checks.filter((c) => c.tone !== "ok").length;
  const items = [
    { href: "/", label: "Overview", count: attention || undefined },
    { href: "/how", label: "How it works" },
    { href: "/graph", label: "Map of links" },
    { href: "/skills", label: "Skills", count: brain.skills.length, group: "What is inside" },
    { href: "/agents", label: "Specialists", count: brain.agents.length },
    { href: "/commands", label: "Commands", count: brain.commands.length },
    { href: "/tools", label: "Tools and MCP", count: brain.mcpServers.length + brain.scripts.length },
    { href: "/references", label: "Checklists", count: brain.references.length },
    { href: "/manual", label: "Manual" },
    { href: "/repos", label: "Projects", count: brain.repoNotes.length, group: "Memory" },
    { href: "/designs", label: "Designs", count: brain.designs.length },
    { href: "/status", label: "Repo status" },
  ];
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <aside className="side">
            <div className="brand">
              <b>Engineer Brain</b>
              <span className="small muted mono">{brain.repo}</span>
              <span className="small muted">Read live every {REVALIDATE_SECONDS / 60} min</span>
            </div>
            <Nav items={items} />
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
