"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; count?: number; group?: string };

export function Nav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  // A group heading goes before the first item that carries that group name.
  const firstOfGroup = new Map(items.filter((i) => i.group).map((i) => [i.group!, i.href]));
  return (
    <nav className="nav" aria-label="Sections">
      {items.map((item) => {
        const heading = item.group && firstOfGroup.get(item.group) === item.href ? <div className="nav-group" key={`g-${item.group}`}>{item.group}</div> : null;
        const current = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <span key={item.href} style={{ display: "contents" }}>
            {heading}
            <Link href={item.href} aria-current={current ? "page" : undefined}>
              <span>{item.label}</span>
              {item.count !== undefined ? <span className="n">{item.count}</span> : null}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
