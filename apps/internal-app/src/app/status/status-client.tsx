"use client";
/** システムステータス。DB・外部連携・Webhook等の稼働状況を表示。 */
import * as React from "react";
import { Alert, Button, PageShell } from "@platform/ui";

interface Check { name: string; status: "up" | "down"; durationMs: number; error?: string; }
interface Report { status: "healthy" | "unhealthy"; checks: Check[]; timestamp: number; summary: { up: number; down: number; total: number }; }
const LABEL: Record<string, string> = { database: "データベース", mail: "メール", zoho: "Zoho連携", webhooks: "送信Webhook" };

export function StatusClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [report, setReport] = React.useState<Report | null>(null);
  const [error, setError] = React.useState("");
  const load = React.useCallback(async () => { try { const r = await doFetch("/api/status"); setReport((await r.json()) as Report); setError(""); } catch {
      // **失敗しても画面は残す。**
      // ここは「システムの状態」を見る画面。取れないこと自体が異常の兆候だが、
      // 白い画面にすると何も分からなくなる。前回の値を出したまま待つ
      setError("状態を取得できませんでした。しばらくしてから再読み込みしてください");
    }
  }, [doFetch]);
  React.useEffect(() => { void load(); }, [load]);

  // **取れないときに「確認中…」のまま止めない。**
  // ここはシステムの状態を見る画面。動いているのか壊れているのか
  // 分からない表示が、いちばん困る
  if (!report) {
    return (
      <PageShell title="システムステータス" width="narrow">
        {error !== "" ? <Alert variant="danger">{error}</Alert> : <p className="text-sm text-[var(--color-muted)]">確認中…</p>}
        <Button className="mt-3" variant="secondary" onClick={() => void load()}>再試行</Button>
      </PageShell>
    );
  }
  return (
    <PageShell
      title="システムステータス"
      width="narrow"
      actions={<Button onClick={() => void load()} variant="secondary">更新</Button>}
    >
      {error !== "" && <Alert variant="danger" className="mb-3">{error}</Alert>}
      <div className={`mb-4 rounded p-4 ${report.status === "healthy" ? "bg-[color-mix(in_srgb,var(--color-success)_8%,transparent)] text-[var(--color-success)]" : "bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] text-[var(--color-danger)]"}`}>
        <span className="text-lg font-semibold">{report.status === "healthy" ? "✓ 全システム正常" : "⚠ 一部に問題があります"}</span>
        <span className="ml-3 text-sm">{report.summary.up}/{report.summary.total} 稼働中</span>
      </div>
      <ul className="divide-y divide-neutral-100 rounded border border-[var(--color-border)]">
        {report.checks.map((c) => (
          <li key={c.name} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-medium">{LABEL[c.name] ?? c.name}</span>
            <span className="flex items-center gap-2 text-sm">
              {c.error && <span className="text-xs text-[var(--color-danger)]">{c.error}</span>}
              <span className="text-xs text-[var(--color-muted)]">{c.durationMs}ms</span>
              <span className={`rounded px-2 py-0.5 text-xs ${c.status === "up" ? "bg-[color-mix(in_srgb,var(--color-success)_15%,transparent)] text-[var(--color-success)]" : "bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)] text-[var(--color-danger)]"}`}>{c.status === "up" ? "稼働中" : "停止"}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-[var(--color-muted)]">最終確認: {new Date(report.timestamp).toLocaleString("ja-JP")}</p>
    </PageShell>
  );
}
