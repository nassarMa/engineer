import Link from "next/link";
import type { ReactNode } from "react";
import { KIND_LABEL, type NodeKind } from "@/lib/graph";
import type { Tone } from "@/lib/health";

export const KIND_COLOR: Record<NodeKind, string> = {
  manual: "var(--k-manual)",
  agent: "var(--k-agent)",
  skill: "var(--k-skill)",
  "vendored-skill": "var(--k-vendored)",
  command: "var(--k-command)",
  mcp: "var(--k-mcp)",
  script: "var(--k-script)",
  reference: "var(--k-reference)",
};

export function Pill({ tone, children }: { tone: Tone | "info"; children: ReactNode }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export function KindPill({ kind }: { kind: NodeKind }) {
  return (
    <span className="pill kind" style={{ background: KIND_COLOR[kind] }}>
      {KIND_LABEL[kind]}
    </span>
  );
}

export function Chip({ href, kind, children }: { href: string; kind?: NodeKind; children: ReactNode }) {
  return (
    <Link href={href} className="chip">
      {kind ? <span className="sw" style={{ background: KIND_COLOR[kind] }} aria-hidden /> : null}
      {children}
    </Link>
  );
}

export function Tile({ label, value, sub, href }: { label: string; value: string | number; sub?: string; href?: string }) {
  const body = (
    <>
      <span className="label">{label}</span>
      <span className="value">{value}</span>
      {sub ? <span className="sub">{sub}</span> : null}
    </>
  );
  return href ? (
    <Link href={href} className="tile">
      {body}
    </Link>
  ) : (
    <div className="tile">{body}</div>
  );
}

export function Card({ title, aside, children }: { title?: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      {title ? (
        <header>
          <h2>{title}</h2>
          {aside}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Bars({ rows, color }: { rows: { label: string; value: number; color?: string }[]; color?: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="bars">
      {rows.map((r) => (
        <div className="bar" key={r.label}>
          <span>{r.label}</span>
          <div className="track" aria-hidden>
            <div className="fill" style={{ width: `${(r.value / max) * 100}%`, background: r.color ?? color }} />
          </div>
          <span className="n">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso).toISOString().slice(0, 10) : "—");
export const ago = (iso: string, now = Date.now()) => {
  const d = Math.floor((now - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};
