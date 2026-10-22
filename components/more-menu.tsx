"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export interface MenuItem {
  label: string;
  href: string;
  /** Open in a new tab (printable pages). */
  newTab?: boolean;
  /** A file download (CSV exports). */
  download?: boolean;
}

/** A page's less-used actions (export, import, print…), so the page header
 *  keeps a single main button. */
export function MoreMenu({ items, label = "More" }: { items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on a click elsewhere or Esc.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (items.length === 0) return null;
  const itemClass = "block px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 focus:bg-neutral-50 focus:outline-none";
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} className="btn-secondary gap-1 px-3">
        {label}
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="size-4 text-neutral-500">
          <path fillRule="evenodd" d="M5.2 7.2a.75.75 0 0 1 1.06.02L10 11.1l3.74-3.88a.75.75 0 1 1 1.08 1.04l-4.28 4.44a.75.75 0 0 1-1.08 0L5.18 8.26a.75.75 0 0 1 .02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-neutral-200">
          {items.map((item) =>
            item.newTab || item.download ? (
              <a
                key={item.label}
                role="menuitem"
                href={item.href}
                {...(item.newTab ? { target: "_blank", rel: "noreferrer" } : { download: "" })}
                onClick={() => setOpen(false)}
                className={itemClass}
              >
                {item.label}
              </a>
            ) : (
              <Link key={item.label} role="menuitem" href={item.href} onClick={() => setOpen(false)} className={itemClass}>
                {item.label}
              </Link>
            ),
          )}
        </div>
      )}
    </div>
  );
}
