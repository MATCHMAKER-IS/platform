"use client";
/** 管理コンソール。お知らせ配信・システム設定・監査ダッシュボード・権限マトリクス・ヘルス・ログイン監視を1画面に集約。 */
import * as React from "react";
import { Button, Input, Textarea } from "@platform/ui";

interface Count { key: string; count: number; }
interface Settings { companyName: string; fiscalClosingMonth: number; consumptionTaxRate: number; mailFrom: string; invoicePrefix: string; signatureThreshold: number; }
interface Matrix { roles: string[]; rows: { key: string; label: string; allow: boolean[] }[]; }
interface Health { healthy: boolean; checks: { name: string; ok: boolean; detail?: string }[]; counts: Record<string, number>; }
interface AuditRow { seq?: number; actor: string; action: string; at?: string }
interface Anomaly { level: "warning" | "critical"; kind: string; title: string; detail: string; actor: string; }
const ROLE_LABEL: Record<string, string> = { employee: "一般", editor: "編集", manager: "管理者", finance: "経理", admin: "管理" };

export interface AdminConsoleClientProps { fetchImpl?: typeof fetch; }

export function AdminConsoleClient({ fetchImpl }: AdminConsoleClientProps) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [tab, setTab] = React.useState("broadcast");
  const [error, setError] = React.useState("");

  // お知らせ
  const [bc, setBc] = React.useState({ subject: "", body: "" });
  const [bcMsg, setBcMsg] = React.useState("");
  const sendBroadcast = async () => {
    setBcMsg(""); setError("");
    if (!bc.subject || !bc.body) { setBcMsg("件名と本文を入力してください"); return; }
    const res = await doFetch("/api/admin/broadcast", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(bc) });
    if (res.ok) { const d = (await res.json()) as { delivered: number }; setBcMsg(`${d.delivered} 名に配信しました`); setBc({ subject: "", body: "" }); }
    else setBcMsg(((await res.json()) as { error?: string }).error ?? "配信に失敗しました");
  };

  // 設定
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [setMsg, setSetMsg] = React.useState("");
  const loadSettings = React.useCallback(async () => { const r = await doFetch("/api/admin/settings"); if (r.ok) setSettings(((await r.json()) as { settings: Settings }).settings); }, [doFetch]);
  const saveSettings = async () => {
    if (!settings) return;
    setSetMsg("");
    const r = await doFetch("/api/admin/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ companyName: settings.companyName, fiscalClosingMonth: String(settings.fiscalClosingMonth), consumptionTaxRate: String(settings.consumptionTaxRate), mailFrom: settings.mailFrom, invoicePrefix: settings.invoicePrefix, signatureThreshold: String(settings.signatureThreshold) }) });
    if (r.ok) { setSettings(((await r.json()) as { settings: Settings }).settings); setSetMsg("保存しました"); }
  };

  // 監査/ログイン/権限/ヘルス
  const [audit, setAudit] = React.useState<{ total: number; byAction: Count[]; byActor: Count[] } | null>(null);
  const [logins, setLogins] = React.useState<{ summary: { total: number; success: number; failure: number; byEvent: Count[] }; recent: AuditRow[] } | null>(null);
  const [matrix, setMatrix] = React.useState<Matrix | null>(null);
  const [health, setHealth] = React.useState<Health | null>(null);
  const [alerts, setAlerts] = React.useState<Anomaly[] | null>(null);
  const [alertMsg, setAlertMsg] = React.useState("");
  const loadAudit = React.useCallback(async () => { const r = await doFetch("/api/admin/audit-summary"); if (r.ok) setAudit(((await r.json()) as { summary: typeof audit }).summary); }, [doFetch]);
  const loadLogins = React.useCallback(async () => {
    const r = await doFetch("/api/admin/logins");
    if (r.ok) setLogins((await r.json()) as { summary: { total: number; success: number; failure: number; byEvent: Count[] }; recent: AuditRow[] });
  }, [doFetch]);
  const loadMatrix = React.useCallback(async () => { const r = await doFetch("/api/admin/permissions"); if (r.ok) setMatrix(((await r.json()) as { matrix: Matrix }).matrix); }, [doFetch]);
  const loadHealth = React.useCallback(async () => { const r = await doFetch("/api/admin/health"); if (r.ok) setHealth(((await r.json()) as { health: Health }).health); }, [doFetch]);
  const loadAlerts = React.useCallback(async () => { const r = await doFetch("/api/admin/audit-alerts"); if (r.ok) setAlerts(((await r.json()) as { anomalies: Anomaly[] }).anomalies); }, [doFetch]);
  const dispatchAlerts = async () => {
    setAlertMsg("");
    const r = await doFetch("/api/admin/audit-alerts", { method: "POST" });
    if (r.ok) { const d = (await r.json()) as { dispatched: number; anomalies: number }; setAlertMsg(d.anomalies === 0 ? "異常は検出されませんでした" : `${d.anomalies} 件の異常を管理者 ${d.dispatched} 名へ配信しました`); }
  };

  React.useEffect(() => {
    if (tab === "settings" && !settings) void loadSettings();
    if (tab === "audit" && !audit) void loadAudit();
    if (tab === "logins" && !logins) void loadLogins();
    if (tab === "permissions" && !matrix) void loadMatrix();
    if (tab === "health" && !health) void loadHealth();
    if (tab === "alerts" && !alerts) void loadAlerts();
  }, [tab, settings, audit, logins, matrix, health, alerts, loadSettings, loadAudit, loadLogins, loadMatrix, loadHealth, loadAlerts]);

  const TABS = [["broadcast", "お知らせ配信"], ["settings", "システム設定"], ["audit", "監査ダッシュボード"], ["permissions", "権限マトリクス"], ["health", "ヘルス"], ["logins", "ログイン監視"], ["alerts", "監査アラート"]];
  const bar = (c: Count[]) => { const max = Math.max(1, ...c.map((x) => x.count)); return c.slice(0, 12).map((x) => (
    <div key={x.key} className="flex items-center gap-2 text-xs"><span className="w-40 truncate text-[var(--color-muted)]">{x.key}</span><span className="h-3 rounded bg-[var(--color-primary)]" style={{ width: `${(x.count / max) * 60}%` }}></span><span className="text-[var(--color-muted)]">{x.count}</span></div>
  )); };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-1 text-2xl font-bold">管理コンソール</h1>
      <p className="mb-4 text-xs text-[var(--color-muted)]">管理者向けの運用機能をまとめています。</p>
      {error && <p className="mb-3 rounded bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-[var(--color-border)]">
        {TABS.map(([k, label]) => <Button key={k} onClick={() => setTab(k!)} className={`px-3 py-2 text-sm ${tab === k ? "border-b-2 border-[var(--color-fg)] font-medium" : "text-[var(--color-muted)]"}`}>{label}</Button>)}
      </div>

      {tab === "broadcast" && (
        <div className="rounded border border-[var(--color-border)] p-4">
          <h2 className="mb-2 text-sm font-medium">全体周知（有効な全利用者の受信箱へ配信）</h2>
          <div className="flex flex-col gap-2">
            <Input value={bc.subject} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBc({ ...bc, subject: e.target.value })} placeholder="件名" className="rounded border border-[var(--color-border)] px-2 py-1 text-sm" />
            <Textarea value={bc.body} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBc({ ...bc, body: e.target.value })} rows={5} placeholder="本文" className="rounded border border-[var(--color-border)] px-2 py-1 text-sm" />
            <div className="flex items-center gap-3"><Button onClick={sendBroadcast} className="self-start rounded bg-[var(--color-fg)] px-4 py-1.5 text-sm text-white">配信する</Button>{bcMsg && <span className="text-xs text-[var(--color-muted)]">{bcMsg}</span>}</div>
          </div>
        </div>
      )}

      {tab === "settings" && settings && (
        <div className="rounded border border-[var(--color-border)] p-4">
          <h2 className="mb-3 text-sm font-medium">システム設定</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-[var(--color-muted)]">会社名<Input value={settings.companyName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, companyName: e.target.value })} className="mt-0.5 block w-full rounded border border-[var(--color-border)] px-2 py-1 text-sm" /></label>
            <label className="text-xs text-[var(--color-muted)]">決算月<Input type="number" value={settings.fiscalClosingMonth} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, fiscalClosingMonth: Number(e.target.value) })} className="mt-0.5 block w-full rounded border border-[var(--color-border)] px-2 py-1 text-sm" /></label>
            <label className="text-xs text-[var(--color-muted)]">消費税率（例 0.10）<Input value={settings.consumptionTaxRate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, consumptionTaxRate: Number(e.target.value) })} className="mt-0.5 block w-full rounded border border-[var(--color-border)] px-2 py-1 text-sm" /></label>
            <label className="text-xs text-[var(--color-muted)]">送信メール既定From<Input value={settings.mailFrom} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, mailFrom: e.target.value })} className="mt-0.5 block w-full rounded border border-[var(--color-border)] px-2 py-1 text-sm" /></label>
            <label className="text-xs text-[var(--color-muted)]">請求書番号の接頭辞<Input value={settings.invoicePrefix} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, invoicePrefix: e.target.value })} className="mt-0.5 block w-full rounded border border-[var(--color-border)] px-2 py-1 text-sm" /></label>
            <label className="text-xs text-[var(--color-muted)]">承認で署名必須の金額（円・0で無効）<Input type="number" value={settings.signatureThreshold} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, signatureThreshold: Number(e.target.value) })} className="mt-0.5 block w-full rounded border border-[var(--color-border)] px-2 py-1 text-sm" /></label>
          </div>
          <div className="mt-3 flex items-center gap-3"><Button onClick={saveSettings} className="rounded bg-[var(--color-fg)] px-4 py-1.5 text-sm text-white">保存</Button>{setMsg && <span className="text-xs text-[var(--color-muted)]">{setMsg}</span>}</div>
        </div>
      )}

      {tab === "audit" && audit && (
        <div className="rounded border border-[var(--color-border)] p-4">
          <h2 className="mb-2 text-sm font-medium">監査ダッシュボード（直近1000件・計 {audit.total} 件）</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><h3 className="mb-1 text-xs font-medium text-[var(--color-muted)]">操作種別</h3><div className="space-y-1">{bar(audit.byAction)}</div></div>
            <div><h3 className="mb-1 text-xs font-medium text-[var(--color-muted)]">操作者</h3><div className="space-y-1">{bar(audit.byActor)}</div></div>
          </div>
        </div>
      )}

      {tab === "permissions" && matrix && (
        <div className="overflow-x-auto rounded border border-[var(--color-border)] p-4">
          <h2 className="mb-2 text-sm font-medium">権限マトリクス（ロール × 機能）</h2>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]"><th className="px-2 py-1 text-left">機能</th>{matrix.roles.map((r) => <th key={r} className="px-2 py-1 text-center">{ROLE_LABEL[r] ?? r}</th>)}</tr></thead>
            <tbody>{matrix.rows.map((row) => <tr key={row.key} className="border-b border-[var(--color-border)]"><td className="px-2 py-1.5">{row.label}</td>{row.allow.map((a, i) => <td key={i} className="px-2 py-1.5 text-center">{a ? <span className="text-[var(--color-success)]">✓</span> : <span className="text-[color-mix(in_srgb,var(--color-primary-fg)_75%,transparent)]">—</span>}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}

      {tab === "health" && health && (
        <div className="rounded border border-[var(--color-border)] p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-medium">システムヘルス {health.healthy ? <span className="rounded bg-[color-mix(in_srgb,var(--color-success)_15%,transparent)] px-2 py-0.5 text-xs text-[var(--color-success)]">正常</span> : <span className="rounded bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)] px-2 py-0.5 text-xs text-[var(--color-danger)]">要確認</span>}</h2>
          <div className="mb-3 flex flex-wrap gap-3">{Object.entries(health.counts).map(([k, v]) => <div key={k} className="rounded bg-[var(--color-subtle)] px-3 py-2 text-center"><div className="text-xs text-[var(--color-muted)]">{k}</div><div className="text-lg font-bold">{v}</div></div>)}</div>
          <ul className="space-y-1 text-sm">{health.checks.map((c, i) => <li key={i} className="flex items-center gap-2">{c.ok ? <span className="text-[var(--color-success)]">✓</span> : <span className="text-[var(--color-danger)]">✗</span>}<span>{c.name}</span>{c.detail && <span className="text-xs text-[var(--color-muted)]">（{c.detail}）</span>}</li>)}</ul>
        </div>
      )}

      {tab === "logins" && logins && (
        <div className="rounded border border-[var(--color-border)] p-4">
          <h2 className="mb-2 text-sm font-medium">ログイン監視</h2>
          <div className="mb-3 flex gap-3">
            <div className="rounded bg-[var(--color-subtle)] px-3 py-2 text-center"><div className="text-xs text-[var(--color-muted)]">総数</div><div className="text-lg font-bold">{logins.summary.total}</div></div>
            <div className="rounded bg-[color-mix(in_srgb,var(--color-success)_8%,transparent)] px-3 py-2 text-center"><div className="text-xs text-[var(--color-success)]">成功</div><div className="text-lg font-bold text-[var(--color-success)]">{logins.summary.success}</div></div>
            <div className="rounded bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] px-3 py-2 text-center"><div className="text-xs text-[var(--color-danger)]">失敗</div><div className="text-lg font-bold text-[var(--color-danger)]">{logins.summary.failure}</div></div>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted)]"><th className="px-2 py-1">日時</th><th className="px-2 py-1">利用者</th><th className="px-2 py-1">イベント</th></tr></thead>
            <tbody>{logins.recent.map((r, i) => <tr key={i} className="border-b border-[var(--color-border)]"><td className="px-2 py-1.5 text-xs">{(r.at ?? "").replace("T", " ").slice(0, 16)}</td><td className="px-2 py-1.5">{r.actor}</td><td className="px-2 py-1.5">{r.action}</td></tr>)}</tbody>
          </table>
          {logins.recent.length === 0 && <p className="text-xs text-[var(--color-muted)]">ログインイベントはまだありません。</p>}
        </div>
      )}

      {tab === "alerts" && alerts && (
        <div className="rounded border border-[var(--color-border)] p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium">監査アラート（大量削除・ログイン失敗の連続・深夜帯の操作）</h2>
            <Button onClick={dispatchAlerts} className="rounded bg-[var(--color-fg)] px-4 py-1.5 text-sm text-white">管理者へ通知</Button>
          </div>
          {alertMsg && <p className="mb-2 text-xs text-[var(--color-muted)]">{alertMsg}</p>}
          {alerts.length === 0 ? (
            <p className="rounded bg-[color-mix(in_srgb,var(--color-success)_8%,transparent)] px-3 py-2 text-sm text-[var(--color-success)]">検出された異常はありません。</p>
          ) : (
            <ul className="space-y-2">
              {alerts.map((a, i) => (
                <li key={i} className={`rounded border-l-4 px-3 py-2 text-sm ${a.level === "critical" ? "border-[var(--color-danger)] bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)]" : "border-[color-mix(in_srgb,var(--color-warning)_70%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_8%,transparent)]"}`}>
                  <span className={`mr-2 rounded px-1.5 py-0.5 text-xs ${a.level === "critical" ? "bg-[var(--color-danger)] text-white" : "bg-[var(--color-warning)] text-white"}`}>{a.level === "critical" ? "重大" : "警告"}</span>
                  <span className="font-medium">{a.title}</span>
                  <p className="mt-0.5 text-xs text-[var(--color-muted)]">{a.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
