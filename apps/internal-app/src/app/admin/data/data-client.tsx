"use client";
/** 管理: データ管理。バックアップ復元・監査アーカイブ・検索インデックス再構築を1画面に集約。 */
import * as React from "react";

interface PlanItem { name: string; count: number; restorable: boolean; }
interface RestoreResult { dryRun: boolean; applied: { name: string; count: number }[]; skipped: { name: string; reason: string }[]; }

export function DataClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [tab, setTab] = React.useState("restore");
  const [json, setJson] = React.useState("");
  const [plan, setPlan] = React.useState<PlanItem[] | null>(null);
  const [result, setResult] = React.useState<RestoreResult | null>(null);
  const [before, setBefore] = React.useState(new Date().toISOString().slice(0, 10));
  const [reindexMsg, setReindexMsg] = React.useState("");
  const [msg, setMsg] = React.useState("");

  const restore = async (dryRun: boolean) => {
    setMsg(""); setResult(null);
    let bundle: unknown;
    try { bundle = JSON.parse(json); } catch { setMsg("JSON が不正です"); return; }
    const r = await doFetch("/api/admin/restore", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bundle, dryRun }) });
    if (r.ok) { const d = (await r.json()) as { plan: PlanItem[]; result: RestoreResult }; setPlan(d.plan); setResult(d.result); }
    else setMsg(((await r.json()) as { error?: string }).error ?? "失敗しました");
  };
  const reindex = async () => {
    setReindexMsg("再構築中…");
    const r = await doFetch("/api/admin/reindex", { method: "POST" });
    if (r.ok) setReindexMsg(`索引を再構築しました（${((await r.json()) as { indexed: number }).indexed} 件）`);
    else setReindexMsg("失敗しました");
  };

  const TABS = [["restore", "復元/インポート"], ["archive", "監査アーカイブ"], ["reindex", "検索インデックス"]];
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-2xl font-bold">データ管理</h1>
      <div className="mb-4 flex gap-1 border-b border-neutral-200">
        {TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k!)} className={`px-3 py-2 text-sm ${tab === k ? "border-b-2 border-neutral-900 font-medium" : "text-neutral-500"}`}>{l}</button>)}
      </div>
      {msg && <p className="mb-3 text-sm text-red-600">{msg}</p>}

      {tab === "restore" && (
        <div className="rounded border border-neutral-200 p-4">
          <p className="mb-2 text-xs text-neutral-500">バックアップ JSON を貼り付けます。安全なデータセット（設定・取引先）のみ適用され、それ以外はプレビュー扱いです。まず「プレビュー」で内容を確認してください。</p>
          <textarea value={json} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setJson(e.target.value)} rows={8} placeholder='{"app":"internal-app","version":1,"datasets":[...]}' className="block w-full rounded border border-neutral-300 px-2 py-1 font-mono text-xs" />
          <div className="mt-2 flex gap-2">
            <button onClick={() => void restore(true)} className="rounded border border-neutral-300 px-4 py-2 text-sm">プレビュー</button>
            <button onClick={() => void restore(false)} className="rounded bg-neutral-900 px-4 py-2 text-sm text-white">復元を実行</button>
          </div>
          {plan && (
            <div className="mt-3 text-sm">
              <p className="font-medium">内容:</p>
              <ul className="mt-1 space-y-0.5">{plan.map((p) => <li key={p.name} className="text-xs">{p.name}: {p.count}件 {p.restorable ? <span className="text-green-600">復元可</span> : <span className="text-neutral-400">対象外</span>}</li>)}</ul>
              {result && <p className="mt-2 text-xs text-neutral-600">{result.dryRun ? "プレビュー" : "適用"}: {result.applied.map((a) => `${a.name} ${a.count}件`).join("、") || "なし"}{result.skipped.length > 0 && `（スキップ: ${result.skipped.map((s) => s.name).join("、")}）`}</p>}
            </div>
          )}
        </div>
      )}

      {tab === "archive" && (
        <div className="rounded border border-neutral-200 p-4">
          <p className="mb-2 text-xs text-neutral-500">指定日以前の監査ログを整合性チェックサム付きでダウンロードします。監査はハッシュチェーンのため、破壊的削除は行わず長期保管用のエクスポートを提供します。</p>
          <label className="text-xs text-neutral-500">この日付以前<input type="date" value={before} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBefore(e.target.value)} className="ml-2 rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
          <div className="mt-3"><a href={`/api/admin/audit-archive?before=${before}T23:59:59Z`} className="inline-block rounded bg-neutral-900 px-4 py-2 text-sm text-white">アーカイブをダウンロード</a></div>
        </div>
      )}

      {tab === "reindex" && (
        <div className="rounded border border-neutral-200 p-4">
          <p className="mb-2 text-xs text-neutral-500">横断検索のインデックスを、現在の請求・取引先・監査ログから再構築します。データ移行後や不整合時に実行してください。</p>
          <button onClick={() => void reindex()} className="rounded bg-neutral-900 px-4 py-2 text-sm text-white">インデックスを再構築</button>
          {reindexMsg && <p className="mt-2 text-sm text-neutral-700">{reindexMsg}</p>}
        </div>
      )}
    </div>
  );
}
