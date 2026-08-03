"use client";
/**
 * ダッシュボード。/api/dashboard を取得し、未読数・最近の通知・ファイル・監査イベントをまとめて表示する。
 * @packageDocumentation
 */
import * as React from "react";
// **SimpleStatCard を使う。** @platform/ui には StatCard が 2 つあり、
// 主(dashboard.tsx)は delta / trend / format を持つが **hint / href は無い**。
// ここは「値＋単位＋リンク」なので SimpleStatCard(stat-card.tsx)が合う。
import { AuditLogView, Card, ComboChart, FileList, Input, List, SimpleStatCard, type AuditLogRow, type FileListItem } from "@platform/ui";

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
        {show("unread") && <SimpleStatCard label="未読通知" value={data.unreadCount} icon="🔔" href="/notifications" />}
        {show("pendingApprovals") && <SimpleStatCard label="承認待ち" value={data.pendingApprovals} hint="全体" icon="📝" href="/expenses" />}
        {show("receivables") && <SimpleStatCard label="売掛残高" value={`¥${(data.receivablesTotal ?? 0).toLocaleString()}`} hint="未回収" icon="💰" href="/receivables" />}
        {show("inventoryAlerts") && <SimpleStatCard label="在庫アラート" value={data.inventoryAlerts ?? 0} hint="発注要" icon="📦" href="/inventory" />}
      </div>
      {trend.length > 0 && <div><TrendChart points={trend} /></div>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {show("myTasks") && <SimpleStatCard label="自分の申請（承認待ち）" value={data.myPendingRequests} hint="担当タスク" icon="✅" href="/expenses" />}
        {show("recentFiles") && <SimpleStatCard label="最近のファイル" value={data.recentFiles.length} icon="📁" href="/files" />}
        {show("mailbox") && <SimpleStatCard label="受信箱の未読" value={data.mailboxUnread} icon="✉️" href="/mailbox" />}
        {show("inquiries") && <SimpleStatCard label="未対応の問い合わせ" value={data.openInquiries} icon="📮" href="/inquiries" />}
        {show("alerts") && <SimpleStatCard label="運用アラート" value={data.activeAlerts} icon="⚠️" href="/overview" />}
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
  // **グラフは @platform/ui の ComboChart に任せる**(軸・凡例・整形・ツールチップ込み)。
  // 自前 SVG だと目盛りもツールチップも毎回作り直しになる
  const data = points.map((p) => ({
    month: `${p.month.slice(5)}月`,
    sales: p.sales,
    outstanding: p.outstanding,
    purchases: p.purchases,
    expenses: p.expenses,
  }));
  return (
    <div className="rounded border border-neutral-200 p-4">
      <p className="mb-2 text-sm font-medium">売上・売掛の推移（直近6か月）</p>
      <ComboChart
        data={data}
        xKey="month"
        height={200}
        unit="currency"
        series={[
          { key: "sales", name: "売上", type: "bar" },
          { key: "outstanding", name: "売掛残高", type: "line" },
          { key: "purchases", name: "仕入", type: "line" },
          { key: "expenses", name: "経費", type: "line" },
        ]}
      />
    </div>
  );
}
