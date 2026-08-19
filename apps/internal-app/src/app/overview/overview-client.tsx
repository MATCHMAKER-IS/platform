"use client";
/** 経営ダッシュボード。売掛・買掛・在庫・勤怠承認・請求の KPI を一画面に集約。 */
import * as React from "react";
import { formatYen } from "@platform/report";
import { AsyncBoundary, Button, PageShell } from "@platform/ui";

interface Kpi {
  receivables: { outstanding: number; overdue: number };
  payables: { outstanding: number; overdue: number };
  reorderCount: number;
  pendingApprovals: number;
  overdueInvoices: number;
  workingCapital: number;
  actionItems: number;
}

interface Alert { level: "warning" | "info"; title: string; body: string; href: string; }
const yen = (n: number) => formatYen(n);

export interface OverviewClientProps { fetchImpl?: typeof fetch; }

export function OverviewClient({ fetchImpl }: OverviewClientProps) {
  const [kpi, setKpi] = React.useState<Kpi | null>(null);
  const [alerts, setAlerts] = React.useState<Alert[]>([]);
  const [sent, setSent] = React.useState("");
  // **この state 宣言が欠落していた。** `setError`/`error` は使われて
  // いるのに宣言が無く、確実に型エラーになっていた
  // (2026-08、ユーザーの typecheck.log で発見)。
  const [error, setError] = React.useState("");
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  // **再試行できるように名前を付ける。**
  // 即時関数のままだと、失敗しても呼び直す手段が無い
  const load = React.useCallback(async () => {
    setError("");
      try {
        const res = await doFetch("/api/dashboard/kpi");
        // **失敗を握らない。** 握ると「読み込み中…」のまま止まる
        if (!res.ok) { setError("データを取得できませんでした"); return; }
        setKpi((await res.json()) as Kpi);
      } catch {
        setError("通信に失敗しました。ネットワークを確認してください");
      }
      const a = await doFetch("/api/alerts");
      if (a.ok) setAlerts(((await a.json()) as { alerts: Alert[] }).alerts);
  }, [doFetch]);

  React.useEffect(() => { void load(); }, [load]);

  const notifyMe = async () => {
    setSent("");
    const res = await doFetch("/api/alerts/dispatch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
    if (res.ok) { const d = (await res.json()) as { sent: number; emailed: boolean }; setSent(d.sent > 0 ? `${d.sent} 件のアラートを通知${d.emailed ? "とメール" : ""}に送りました` : "通知するアラートはありません"); }
  };

  // **`AsyncBoundary` に渡す前に返す。** children は JSX なので
  // **この部品が判断するより先に評価される**——`kpi` が null のままだと
  // `kpi.…` で画面ごと落ちる(2026-08 の型検査で 7 画面が同じ形だった)。
  if (kpi === null) {
    return <AsyncBoundary loading={error === ""} error={error} onRetry={() => void load()} />;
  }

  return (
    <AsyncBoundary loading={false} error={error} onRetry={() => void load()}>
        <PageShell title="ダッシュボード" width="wide">
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded border border-[var(--color-border)] p-4">
          <div className="text-xs text-[var(--color-muted)]">運転資本（売掛−買掛）</div>
          <div className={`mt-1 text-2xl font-bold ${kpi.workingCapital >= 0 ? "text-[var(--color-fg)]" : "text-[var(--color-danger)]"}`}>{yen(kpi.workingCapital)}</div>
        </div>
        <div className="rounded border border-[var(--color-border)] p-4">
          <div className="text-xs text-[var(--color-muted)]">売掛未収</div>
          <div className="mt-1 text-2xl font-bold">{yen(kpi.receivables.outstanding)}</div>
          {kpi.receivables.overdue > 0 && <div className="mt-1 text-xs text-[var(--color-danger)]">うち期限超過 {yen(kpi.receivables.overdue)}</div>}
        </div>
        <div className="rounded border border-[var(--color-border)] p-4">
          <div className="text-xs text-[var(--color-muted)]">買掛未払</div>
          <div className="mt-1 text-2xl font-bold">{yen(kpi.payables.outstanding)}</div>
          {kpi.payables.overdue > 0 && <div className="mt-1 text-xs text-[var(--color-danger)]">うち期限超過 {yen(kpi.payables.overdue)}</div>}
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="mb-6 rounded border border-[var(--color-border)] p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium">アラート（{alerts.length} 件）</h2>
            <Button onClick={notifyMe} variant="secondary" className="rounded px-3 py-1 text-xs">自分に通知する</Button>
          </div>
          {sent && <p className="mb-2 text-xs text-[var(--color-success)]">{sent}</p>}
          <ul className="space-y-2">
            {alerts.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${a.level === "warning" ? "bg-[var(--color-danger)]" : "bg-[color-mix(in_srgb,var(--color-warning)_70%,transparent)]"}`}></span>
                <a href={a.href} className="hover:underline"><span className="font-medium">{a.title}</span><span className="block text-xs text-[var(--color-muted)]">{a.body}</span></a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="mb-2 text-sm font-medium">要対応（{kpi.actionItems} 件）</h2>
      <div className="grid grid-cols-3 gap-3">
        <a href="/inventory" className="rounded border border-[var(--color-border)] p-4 hover:bg-[var(--color-subtle)]">
          <div className="text-xs text-[var(--color-muted)]">発注が必要な在庫</div>
          <div className={`mt-1 text-2xl font-bold ${kpi.reorderCount > 0 ? "text-[var(--color-warning)]" : "text-[var(--color-muted)]"}`}>{kpi.reorderCount}</div>
        </a>
        <a href="/attendance-approvals" className="rounded border border-[var(--color-border)] p-4 hover:bg-[var(--color-subtle)]">
          <div className="text-xs text-[var(--color-muted)]">承認待ちの勤怠</div>
          <div className={`mt-1 text-2xl font-bold ${kpi.pendingApprovals > 0 ? "text-[var(--color-warning)]" : "text-[var(--color-muted)]"}`}>{kpi.pendingApprovals}</div>
        </a>
        <a href="/invoices" className="rounded border border-[var(--color-border)] p-4 hover:bg-[var(--color-subtle)]">
          <div className="text-xs text-[var(--color-muted)]">期限超過の請求書</div>
          <div className={`mt-1 text-2xl font-bold ${kpi.overdueInvoices > 0 ? "text-[var(--color-danger)]" : "text-[var(--color-muted)]"}`}>{kpi.overdueInvoices}</div>
        </a>
      </div>
    </PageShell>
    </AsyncBoundary>
  );
}
