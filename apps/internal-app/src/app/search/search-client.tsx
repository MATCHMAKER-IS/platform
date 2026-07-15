"use client";
/** 横断全文検索。請求・取引先・監査ログをまとめて検索する。 */
import * as React from "react";

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
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl font-bold">横断検索</h1>
      <div className="flex gap-2">
        <input value={q} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)} onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter") void run(); }} placeholder="請求番号・取引先名・操作など" className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm" />
        <button onClick={() => void run()} className="rounded bg-neutral-900 px-5 py-2 text-sm text-white">検索</button>
      </div>
      {searched && (
        <div className="mt-3 flex gap-1">
          {types.map((t) => <button key={t} onClick={() => setFilter(t)} className={`rounded px-2 py-1 text-xs ${filter === t ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600"}`}>{t === "all" ? "すべて" : TYPE_LABEL[t]}</button>)}
        </div>
      )}
      <ul className="mt-4 divide-y divide-neutral-100">
        {shown.map((r, i) => (
          <li key={i} className="py-2">
            <a href={r.href} className="block hover:bg-neutral-50">
              <span className="mr-2 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600">{TYPE_LABEL[r.type] ?? r.type}</span>
              <span className="text-sm font-medium">{r.title}</span>
              {r.subtitle && <span className="ml-2 text-xs text-neutral-500">{r.subtitle}</span>}
            </a>
          </li>
        ))}
      </ul>
      {searched && shown.length === 0 && <p className="mt-4 text-sm text-neutral-500">該当する結果がありません。</p>}
    </div>
  );
}
