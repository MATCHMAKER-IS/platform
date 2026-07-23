"use client";
/**
 * ダッシュボード。/api/dashboard を取得し、未読数・最近の通知・ファイル・監査イベントをまとめて表示する。
 * @packageDocumentation
 */
import * as React from "react";
import { AuditLogView, Card, FileList, Input, List, StatCard, type AuditLogRow, type FileListItem } from "@platform/ui";

interface DashboardData {
  unreadCount: number;
  receivablesTotal: number;
  inventoryAlerts: number;
  mailboxUnread: number;
  openInquiries: number;
  activeAlerts: number;
  recentNotifications: { id: string; title: string; createdAt: string; read?: boolean }[];
  recentFiles: { key: string; name: string; size: number; type: string; uploadedAt: string; uploadedBy: string }[];
  pendingApprovals: number;
  myPendingRequests: number;
  recentAudit?: AuditLogRow[];
  auditValid?: boolean;
}

export interface DashboardClientProps {
  fetchImpl?: typeof fetch;
}

export function DashboardClient({ fetchImpl }: DashboardClientProps) {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [auditRows, setAuditRows] = React.useState<AuditLogRow[]>([]);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [widgetPref, setWidgetPref] = React.useState<string[] | null>(null);
  const [trend, setTrend] = React.useState<{ month: string; sales: number; outstanding: number; purchases: number; expenses: number }[]>([]);
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const show = (key: string) => widgetPref === null || widgetPref.includes(key);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const res = await doFetch("/api/dashboard");
      if (!alive || !res.ok) return;
      const d = (await res.json()) as DashboardData;
      setData(d);
      if (d.recentAudit) setAuditRows(d.recentAudit);
    })();
    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const res = await doFetch("/api/dashboard/preferences");
      if (!alive || !res.ok) return;
      const data = (await res.json()) as { preference: { widgets: string[] } };
      setWidgetPref(data.preference.widgets);
      try { const tr = await fetch("/api/dashboard/trend?months=6"); if (tr.ok) setTrend(((await tr.json()) as { points: typeof trend }).points); } catch { /* noop */ }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 期間指定で監査ログを絞り込む（管理者のみ有効）
  React.useEffect(() => {
    if (!data?.recentAudit) return;
    if (!from && !to) {
      setAuditRows(data.recentAudit);
      return;
    }
    let alive = true;
    const timer = setTimeout(async () => {
      const qs = new URLSearchParams();
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      qs.set("limit", "20");
      const res = await doFetch(`/api/audit?${qs.toString()}`);
      if (!alive || !res.ok) return;
      const ad = (await res.json()) as { rows: AuditLogRow[] };
      setAuditRows(ad.rows);
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [from, to, data]);

  if (!data) return <div className="text-sm text-[var(--color-muted)]">読み込み中…</div>;

  const fileItems: FileListItem[] = data.recentFiles.map((f) => ({ key: f.key, name: f.name, size: f.size, type: f.type, uploadedAt: f.uploadedAt, uploadedByName: f.uploadedBy }));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {show("unread") && <StatCard label="未読通知" value={data.unreadCount} icon="🔔" href="/notifications" />}
        {show("pendingApprovals") && <StatCard label="承認待ち" value={data.pendingApprovals} hint="全体" icon="📝" href="/expenses" />}
        {show("receivables") && <StatCard label="売掛残高" value={`¥${(data.receivablesTotal ?? 0).toLocaleString()}`} hint="未回収" icon="💰" href="/receivables" />}
        {show("inventoryAlerts") && <StatCard label="在庫アラート" value={data.inventoryAlerts ?? 0} hint="発注要" icon="📦" href="/inventory" />}
      </div>
      {trend.length > 0 && <div><TrendChart points={trend} /></div>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {show("myTasks") && <StatCard label="自分の申請（承認待ち）" value={data.myPendingRequests} hint="担当タスク" icon="✅" href="/expenses" />}
        {show("recentFiles") && <StatCard label="最近のファイル" value={data.recentFiles.length} icon="📁" href="/files" />}
        {show("mailbox") && <StatCard label="受信箱の未読" value={data.mailboxUnread} icon="✉️" href="/mailbox" />}
        {show("inquiries") && <StatCard label="未対応の問い合わせ" value={data.openInquiries} icon="📮" href="/inquiries" />}
        {show("alerts") && <StatCard label="運用アラート" value={data.activeAlerts} icon="⚠️" href="/overview" />}
      </div>

      {show("recentNotifications") && (
      <section>
        <h2 className="mb-2 text-sm font-medium">最近の通知</h2>
        <Card>
          <List>
            {data.recentNotifications.map((n) => (
              <div key={n.id} className={`flex items-center justify-between px-3 py-2 text-sm ${n.read ? "text-[var(--color-muted)]" : "font-medium"}`}>
                <span className="truncate">{n.title}</span>
                <span className="ml-2 text-xs text-[var(--color-muted)]">{n.createdAt.slice(0, 16).replace("T", " ")}</span>
              </div>
            ))}
          </List>
        </Card>
      </section>
      )}

      {show("recentFiles") && (
      <section>
        <h2 className="mb-2 text-sm font-medium">最近のファイル</h2>
        <FileList files={fileItems} />
      </section>
      )}

      {data.recentAudit && show("recentAudit") && (
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium">監査イベント</h2>
            <div className="flex items-center gap-1 text-xs">
              <Input type="date" value={from} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFrom(e.target.value)} className="rounded border border-[var(--color-border)] px-2 py-1" aria-label="開始日" />
              <span>〜</span>
              <Input type="date" value={to} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTo(e.target.value)} className="rounded border border-[var(--color-border)] px-2 py-1" aria-label="終了日" />
            </div>
          </div>
          <AuditLogView rows={auditRows} verification={data.auditValid !== undefined ? { valid: data.auditValid, brokenAt: null } : undefined} />
        </section>
      )}
    </div>
  );
}

function TrendChart({ points }: { points: { month: string; sales: number; outstanding: number; purchases: number; expenses: number }[] }) {
  if (points.length === 0) return null;
  const w = 520, h = 160, pad = 28;
  const max = Math.max(1, ...points.map((p) => Math.max(p.sales, p.purchases, p.expenses)));
  const bw = (w - pad * 2) / points.length;
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const line = points.map((p, i) => `${pad + bw * i + bw / 2},${y(p.outstanding)}`).join(" ");
  return (
    <div className="rounded border border-neutral-200 p-4">
      <p className="mb-2 text-sm font-medium">売上・売掛の推移（直近6か月）</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="売上と売掛残高の月次推移">
        {points.map((p, i) => {
          const bh = h - pad - y(p.sales);
          return <rect key={p.month} x={pad + bw * i + bw * 0.2} y={y(p.sales)} width={bw * 0.6} height={Math.max(0, bh)} fill="#3b82f6" opacity={0.8} />;
        })}
        <polyline points={line} fill="none" stroke="var(--color-danger, #ef4444)" strokeWidth={2} />
        {points.map((p, i) => <circle key={p.month} cx={pad + bw * i + bw / 2} cy={y(p.outstanding)} r={2.5} fill="var(--color-danger, #ef4444)" />)}
        <polyline points={points.map((p, i) => `${pad + bw * i + bw / 2},${y(p.purchases)}`).join(" ")} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 2" />
        <polyline points={points.map((p, i) => `${pad + bw * i + bw / 2},${y(p.expenses)}`).join(" ")} fill="none" stroke="#8b5cf6" strokeWidth={1.5} strokeDasharray="2 2" />
        {points.map((p, i) => <text key={p.month} x={pad + bw * i + bw / 2} y={h - 8} textAnchor="middle" fontSize={9} fill="var(--color-muted, #888)">{p.month.slice(5)}月</text>)}
      </svg>
      <div className="mt-1 flex gap-4 text-xs text-neutral-500"><span><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: "#3b82f6" }} />売上</span><span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "var(--color-danger, #ef4444)" }} />売掛残高</span><span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "#f59e0b" }} />仕入</span><span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "#8b5cf6" }} />経費</span></div>
    </div>
  );
}
