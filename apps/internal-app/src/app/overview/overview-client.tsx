"use client";
/** 経営ダッシュボード。売掛・買掛・在庫・勤怠承認・請求の KPI を一画面に集約。 */
import * as React from "react";
import { Button } from "@platform/ui";

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
const yen = (n: number) => `¥${n.toLocaleString()}`;

export interface OverviewClientProps { fetchImpl?: typeof fetch; }

export function OverviewClient({ fetchImpl }: OverviewClientProps) {
  const [kpi, setKpi] = React.useState<Kpi | null>(null);
  const [alerts, setAlerts] = React.useState<Alert[]>([]);
  const [sent, setSent] = React.useState("");
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  React.useEffect(() => {
    void (async () => {
      const res = await doFetch("/api/dashboard/kpi");
      if (res.ok) setKpi((await res.json()) as Kpi);
      const a = await doFetch("/api/alerts");
      if (a.ok) setAlerts(((await a.json()) as { alerts: Alert[] }).alerts);
    })();
  }, [doFetch]);

  const notifyMe = async () => {
    setSent("");
    const res = await doFetch("/api/alerts/dispatch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
    if (res.ok) { const d = (await res.json()) as { sent: number; emailed: boolean }; setSent(d.sent > 0 ? `${d.sent} 件のアラートを通知${d.emailed ? "とメール" : ""}に送りました` : "通知するアラートはありません"); }
  };

  if (!kpi) return <div className="mx-auto max-w-4xl p-6"><h1 className="text-2xl font-bold">ダッシュボード</h1><p className="mt-4 text-sm text-neutral-500">読み込み中…</p></div>;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-4 text-2xl font-bold">ダッシュボード</h1>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded border border-neutral-200 p-4">
          <div className="text-xs text-neutral-500">運転資本（売掛−買掛）</div>
          <div className={`mt-1 text-2xl font-bold ${kpi.workingCapital >= 0 ? "text-neutral-900" : "text-red-700"}`}>{yen(kpi.workingCapital)}</div>
        </div>
        <div className="rounded border border-neutral-200 p-4">
          <div className="text-xs text-neutral-500">売掛未収</div>
          <div className="mt-1 text-2xl font-bold">{yen(kpi.receivables.outstanding)}</div>
          {kpi.receivables.overdue > 0 && <div className="mt-1 text-xs text-red-600">うち期限超過 {yen(kpi.receivables.overdue)}</div>}
        </div>
        <div className="rounded border border-neutral-200 p-4">
          <div className="text-xs text-neutral-500">買掛未払</div>
          <div className="mt-1 text-2xl font-bold">{yen(kpi.payables.outstanding)}</div>
          {kpi.payables.overdue > 0 && <div className="mt-1 text-xs text-red-600">うち期限超過 {yen(kpi.payables.overdue)}</div>}
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="mb-6 rounded border border-neutral-200 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium">アラート（{alerts.length} 件）</h2>
            <Button onClick={notifyMe} className="rounded border border-neutral-300 px-3 py-1 text-xs">自分に通知する</Button>
          </div>
          {sent && <p className="mb-2 text-xs text-green-700">{sent}</p>}
          <ul className="space-y-2">
            {alerts.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${a.level === "warning" ? "bg-red-500" : "bg-amber-400"}`}></span>
                <a href={a.href} className="hover:underline"><span className="font-medium">{a.title}</span><span className="block text-xs text-neutral-500">{a.body}</span></a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="mb-2 text-sm font-medium">要対応（{kpi.actionItems} 件）</h2>
      <div className="grid grid-cols-3 gap-3">
        <a href="/inventory" className="rounded border border-neutral-200 p-4 hover:bg-neutral-50">
          <div className="text-xs text-neutral-500">発注が必要な在庫</div>
          <div className={`mt-1 text-2xl font-bold ${kpi.reorderCount > 0 ? "text-amber-700" : "text-neutral-400"}`}>{kpi.reorderCount}</div>
        </a>
        <a href="/attendance-approvals" className="rounded border border-neutral-200 p-4 hover:bg-neutral-50">
          <div className="text-xs text-neutral-500">承認待ちの勤怠</div>
          <div className={`mt-1 text-2xl font-bold ${kpi.pendingApprovals > 0 ? "text-amber-700" : "text-neutral-400"}`}>{kpi.pendingApprovals}</div>
        </a>
        <a href="/invoices" className="rounded border border-neutral-200 p-4 hover:bg-neutral-50">
          <div className="text-xs text-neutral-500">期限超過の請求書</div>
          <div className={`mt-1 text-2xl font-bold ${kpi.overdueInvoices > 0 ? "text-red-700" : "text-neutral-400"}`}>{kpi.overdueInvoices}</div>
        </a>
      </div>
    </div>
  );
}
