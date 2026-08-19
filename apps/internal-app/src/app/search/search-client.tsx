"use client";
/** 横断全文検索。請求・取引先・監査ログをまとめて検索する。 */
import * as React from "react";
import { Button, Input, PageShell } from "@platform/ui";

interface Result { type: string; title: string; subtitle: string; href: string; score?: number; }
const TYPE_LABEL: Record<string, string> = { invoice: "請求", partner: "取引先", audit: "監査" };

export function SearchClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<Result[]>([]);
  const [searched, setSearched] = React.useState(false);
  const [filter, setFilter] = React.useState("all");

  const run = React.useCallback(async () => {
    if (q.trim().length === 0) { setResults([]); setSearched(false); return; }
    const r = await doFetch(`/api/search?q=${encodeURIComponent(q)}`);
    if (r.ok) { setResults(((await r.json()) as { results: Result[] }).results); setSearched(true); }
  }, [doFetch, q]);

  const shown = results.filter((r) => filter === "all" || r.type === filter);
  const types = ["all", "invoice", "partner", "audit"];

  return (
        <PageShell title="横断検索" width="narrow">
      <div className="flex gap-2">
        <Input value={q} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)} onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) void run(); }} placeholder="請求番号・取引先名・操作など" className="flex-1 rounded border border-[var(--color-border)] px-3 py-2 text-sm" />
    <Button onClick={() => void run()} className="rounded px-5 py-2 text-sm text-white">検索</Button>
      </div>
      {searched && (
        <div className="mt-3 flex gap-1">
          {types.map((t) => <Button key={t} onClick={() => setFilter(t)} variant="tab" data-state={filter === t ? "active" : undefined}>{t === "all" ? "すべて" : TYPE_LABEL[t]}</Button>)}
        </div>
      )}
      <ul className="mt-4 divide-y divide-neutral-100">
        {shown.map((r, i) => (
          <li key={i} className="py-2">
            <a href={r.href} className="block hover:bg-[var(--color-subtle)]">
              <span className="mr-2 rounded bg-[var(--color-subtle)] px-1.5 py-0.5 text-xs text-[var(--color-muted)]">{TYPE_LABEL[r.type] ?? r.type}</span>
              <span className="text-sm font-medium">{r.title}</span>
              {r.subtitle && <span className="ml-2 text-xs text-[var(--color-muted)]">{r.subtitle}</span>}
            </a>
          </li>
        ))}
      </ul>
      {searched && shown.length === 0 && <p className="mt-4 text-sm text-[var(--color-muted)]">該当する結果がありません。</p>}
    </PageShell>
  );
}
