"use client";
/** CSVインポート。商品マスタ・勘定科目などをCSVで一括登録。まずプレビューで検証エラーを確認できる。 */
import * as React from "react";
import { Button, Textarea } from "@platform/ui";

interface ImportError { line: number; message: string; }
interface Target { key: string; label: string; endpoint: string; columns: string; sample: string; }
const TARGETS: Target[] = [
  { key: "product", label: "商品マスタ", endpoint: "/api/inventory/import", columns: "SKU, 名称, 単位", sample: "SKU,名称,単位\nA001,ボールペン,本\nA002,ノート,冊" },
  { key: "account", label: "勘定科目", endpoint: "/api/accounting/accounts/import", columns: "科目, 区分（asset/liability/equity/revenue/expense）", sample: "科目,区分\n現金,asset\n売上,revenue" },
];

export function ImportClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [target, setTarget] = React.useState<Target>(TARGETS[0]!);
  const [csv, setCsv] = React.useState("");
  const [errors, setErrors] = React.useState<ImportError[] | null>(null);
  const [validCount, setValidCount] = React.useState<number | null>(null);
  const [result, setResult] = React.useState<string>("");

  const send = async (dryRun: boolean) => {
    setResult(""); setErrors(null); setValidCount(null);
    if (csv.trim().length === 0) { setResult("CSV を入力してください"); return; }
    const r = await doFetch(target.endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ csv, dryRun }) });
    const d = (await r.json()) as { valid?: number; imported?: number; skipped?: number; errors?: ImportError[]; error?: string };
    if (!r.ok) { setResult(d.error ?? "失敗しました"); return; }
    setErrors(d.errors ?? []);
    if (dryRun) { setValidCount(d.valid ?? 0); setResult(`プレビュー: ${d.valid ?? 0} 件が有効`); }
    else setResult(`${d.imported ?? 0} 件を登録しました${d.skipped ? `（既存 ${d.skipped} 件はスキップ）` : ""}`);
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl font-bold">CSVインポート</h1>
      <div className="mb-3 flex gap-2">
        {TARGETS.map((t) => <Button key={t.key} onClick={() => { setTarget(t); setCsv(""); setErrors(null); setResult(""); }} className={`rounded px-3 py-1.5 text-sm ${target.key === t.key ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600"}`}>{t.label}</Button>)}
      </div>
      <p className="mb-1 text-xs text-neutral-500">列: {target.columns}</p>
      <Textarea value={csv} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCsv(e.target.value)} rows={8} placeholder={target.sample} className="block w-full rounded border border-neutral-300 px-2 py-1 font-mono text-xs" />
      <div className="mt-2 flex gap-2">
        <Button onClick={() => void send(true)} className="rounded border border-neutral-300 px-4 py-2 text-sm">プレビュー（検証）</Button>
        <Button onClick={() => void send(false)} className="rounded bg-neutral-900 px-4 py-2 text-sm text-white">インポート実行</Button>
        <Button onClick={() => setCsv(target.sample)} className="rounded px-3 py-2 text-xs text-blue-600">サンプルを入力</Button>
      </div>
      {result && <p className="mt-3 rounded bg-neutral-100 px-3 py-2 text-sm text-neutral-700">{result}</p>}
      {errors && errors.length > 0 && (
        <div className="mt-3 rounded border border-red-200 bg-red-50 p-3">
          <p className="mb-1 text-sm font-medium text-red-700">検証エラー（{errors.length}件）</p>
          <ul className="space-y-0.5 text-xs text-red-600">{errors.map((e, i) => <li key={i}>{e.line}行目: {e.message}</li>)}</ul>
        </div>
      )}
      {validCount !== null && errors && errors.length === 0 && <p className="mt-2 text-sm text-green-600">エラーはありません。インポートを実行できます。</p>}
    </div>
  );
}
