import Link from "next/link";
import type { ReactNode } from "react";
import { fileUrl } from "@/lib/github";
import { renderMarkdown } from "@/lib/markdown";

/** A repo file rendered as a page, with where it lives and what sits around it. */
export function DocPage({ title, eyebrow, path, branch, source, aside, children }: { title: ReactNode; eyebrow?: ReactNode; path: string; branch: string; source: string; aside?: ReactNode; children?: ReactNode }) {
  return (
    <>
      <div className="topline">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {eyebrow ? <div>{eyebrow}</div> : null}
          <h1>{title}</h1>
          <p className="small muted">
            <span className="mono">{path}</span> · <a href={fileUrl(branch, path)}>Open on GitHub</a>
          </p>
        </div>
      </div>
      {children}
      <div className="graph-wrap" style={{ gridTemplateColumns: aside ? undefined : "minmax(0, 1fr)" }}>
        <article className="card">
          <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(source, path, branch) }} />
        </article>
        {aside ? <aside className="panel">{aside}</aside> : null}
      </div>
      <p className="small">
        <Link href="/graph">See this piece on the map</Link>
      </p>
    </>
  );
}

export function Neighbours({ title, ids, labels }: { title: string; ids: string[]; labels: Map<string, { label: string; href: string }> }) {
  return (
    <div>
      <b>
        {title} ({ids.length})
      </b>
      {ids.length ? (
        <ul>
          {ids.map((id) => {
            const l = labels.get(id);
            return (
              <li key={id}>
                {l ? (
                  <Link href={l.href} className="mono">
                    {l.label}
                  </Link>
                ) : (
                  <span className="mono">{id}</span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted small">none</p>
      )}
    </div>
  );
}
