import * as React from "react";
import type { Metadata } from "next";
import { content } from "../../server/content";

export const metadata: Metadata = { title: "検索結果", robots: { index: false } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const results = query ? await content.search(query, 20) : [];
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-bold">検索結果</h1>
      {query ? (
        <p className="mb-4 text-sm text-neutral-500">「{query}」の検索結果: {results.length} 件</p>
      ) : (
        <p className="text-sm text-neutral-500">検索語を入力してください。</p>
      )}
      <ul className="flex flex-col gap-4">
        {results.map((r) => (
          <li key={`${r.kind}:${r.slug}`} className="border-b border-neutral-100 pb-3">
            <a href={r.kind === "post" ? `/blog/${r.slug}` : `/${r.slug}`} className="font-medium text-blue-700 hover:underline">
              {r.title}
            </a>
            <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500">{r.kind === "post" ? "記事" : "ページ"}</span>
            <p className="mt-1 text-sm text-neutral-600">{r.snippet}…</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
