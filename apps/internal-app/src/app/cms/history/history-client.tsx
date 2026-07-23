"use client";
/** CMS 操作履歴。監査ログの cms.* 操作を一覧表示する。 */
import * as React from "react";
import { Button } from "@platform/ui";

interface Row {
  seq: number;
  at: string;
  actor: string;
  action: string;
  target: string;
  description?: string;
}

const ACTION_LABEL: Record<string, string> = {
  "cms.post.create": "記事作成", "cms.post.update": "記事更新", "cms.post.delete": "記事削除",
  "cms.page.create": "ページ作成", "cms.page.update": "ページ更新", "cms.page.delete": "ページ削除",
  "cms.announcement.create": "お知らせ作成", "cms.announcement.update": "お知らせ更新", "cms.announcement.delete": "お知らせ削除",
  "cms.category.create": "カテゴリ作成", "cms.category.update": "カテゴリ更新", "cms.category.delete": "カテゴリ削除", "cms.category.reorder": "カテゴリ並べ替え",
  "cms.tag.rename": "タグ変更", "cms.tag.merge": "タグ統合", "cms.tag.remove": "タグ削除",
};

export interface HistoryClientProps { fetchImpl?: typeof fetch; }

export function HistoryClient({ fetchImpl }: HistoryClientProps) {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [filter, setFilter] = React.useState("");
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  React.useEffect(() => {
    void (async () => {
      const res = await doFetch("/api/cms/history");
      if (res.ok) setRows(((await res.json()) as { history: Row[] }).history);
    })();
  }, [doFetch]);

  const kinds = ["post", "page", "announcement", "category", "tag"];
  const shown = filter ? rows.filter((r) => r.target.startsWith(`${filter}:`) || r.action.startsWith(`cms.${filter}.`)) : rows;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-4 text-2xl font-bold">操作履歴</h1>
      <div className="mb-3 flex gap-1">
        <Button onClick={() => setFilter("")} className={filter === "" ? "rounded bg-neutral-900 px-3 py-1 text-sm text-white" : "rounded border border-neutral-300 px-3 py-1 text-sm"}>すべて</Button>
        {kinds.map((k) => (
          <Button key={k} onClick={() => setFilter(k)} className={filter === k ? "rounded bg-neutral-900 px-3 py-1 text-sm text-white" : "rounded border border-neutral-300 px-3 py-1 text-sm"}>
            {k === "post" ? "記事" : k === "page" ? "ページ" : k === "announcement" ? "お知らせ" : k === "category" ? "カテゴリ" : "タグ"}
          </Button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-neutral-500">履歴がありません。</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
              <th className="px-2 py-1">日時</th>
              <th className="px-2 py-1">操作</th>
              <th className="px-2 py-1">対象</th>
              <th className="px-2 py-1">担当</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.seq} className="border-b border-neutral-100">
                <td className="px-2 py-2 text-xs text-neutral-500">{r.at.slice(0, 16).replace("T", " ")}</td>
                <td className="px-2 py-2">{ACTION_LABEL[r.action] ?? r.action}</td>
                <td className="px-2 py-2 font-mono text-xs text-neutral-600">{r.target}</td>
                <td className="px-2 py-2 text-xs text-neutral-500">{r.actor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
