"use client";
/** システムステータス。DB・外部連携・Webhook等の稼働状況を表示。 */
import * as React from "react";

interface Check { name: string; status: "up" | "down"; durationMs: number; error?: string; }
interface Report { status: "healthy" | "unhealthy"; checks: Check[]; timestamp: number; summary: { up: number; down: number; total: number }; }
const LABEL: Record<string, string> = { database: "データベース", mail: "メール", zoho: "Zoho連携", webhooks: "送信Webhook" };

export function StatusClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [report, setReport] = React.useState<Report | null>(null);
  const load = React.useCallback(async () => { try { const r = await doFetch("/api/status"); setReport((await r.json()) as Report); } catch { /* noop */ } }, [doFetch]);
  React.useEffect(() => { void load(); }, [load]);

  if (!report) return <div className="mx-auto max-w-2xl p-6 text-sm text-neutral-500">確認中…</div>;
  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">システムステータス</h1>
        <button onClick={() => void load()} className="rounded border border-neutral-300 px-3 py-1 text-sm">更新</button>
      </div>
      <div className={`mb-4 rounded p-4 ${report.status === "healthy" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
        <span className="text-lg font-semibold">{report.status === "healthy" ? "✓ 全システム正常" : "⚠ 一部に問題があります"}</span>
        <span className="ml-3 text-sm">{report.summary.up}/{report.summary.total} 稼働中</span>
      </div>
      <ul className="divide-y divide-neutral-100 rounded border border-neutral-200">
        {report.checks.map((c) => (
          <li key={c.name} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-medium">{LABEL[c.name] ?? c.name}</span>
            <span className="flex items-center gap-2 text-sm">
              {c.error && <span className="text-xs text-red-500">{c.error}</span>}
              <span className="text-xs text-neutral-400">{c.durationMs}ms</span>
              <span className={`rounded px-2 py-0.5 text-xs ${c.status === "up" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{c.status === "up" ? "稼働中" : "停止"}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-neutral-400">最終確認: {new Date(report.timestamp).toLocaleString("ja-JP")}</p>
    </div>
  );
}
