"use client";
/** サイト共通ヘッダー。ナビ（ドロップダウン対応）＋検索窓。 */
import * as React from "react";
import { NavDropdown, type NavItem } from "@platform/ui";

export function SiteHeader({ siteName, nav }: { siteName: string; nav: NavItem[] }) {
  const [q, setQ] = React.useState("");
  const onSubmit = () => {
    const query = q.trim();
    if (query) (globalThis as unknown as { location: { href: string } }).location.href = `/search?q=${encodeURIComponent(query)}`;
  };
  return (
    <header className="border-b border-neutral-200">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <a href="/" className="text-lg font-bold">{siteName}</a>
        <NavDropdown items={nav} />
        <div className="flex items-center gap-1">
          <input
            value={q}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") onSubmit(); }}
            placeholder="検索…"
            className="w-32 rounded border border-neutral-300 px-2 py-1 text-sm sm:w-48"
            aria-label="サイト内検索"
          />
          <button onClick={onSubmit} className="rounded bg-neutral-900 px-3 py-1 text-sm text-white">検索</button>
        </div>
      </div>
    </header>
  );
}
