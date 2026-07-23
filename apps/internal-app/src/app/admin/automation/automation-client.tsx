"use client";
/** 管理: エクスポートのスケジュール実行と、通知テンプレートの編集。 */
import * as React from "react";
import { Button, Input, Select } from "@platform/ui";

interface Schedule { id: string; type: string; frequency: string; enabled: boolean; lastRunAt?: string; }
interface Run { id: string; type: string; at: string; status: string; recordCount: number; }
interface Tpl { event: string; locales: Record<string, { title: string; body: string }>; }
const TYPE_LABEL: Record<string, string> = { backup: "バックアップ", partners: "取引先", invoices: "請求", audit: "監査ログ" };
const RLABEL: Record<string, string> = { sales: "売上", receivables: "売掛", inventory: "在庫" };

export function AutomationClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [tab, setTab] = React.useState("export");
  const [schedules, setSchedules] = React.useState<Schedule[]>([]);
  const [history, setHistory] = React.useState<Run[]>([]);
  const [newType, setNewType] = React.useState("backup");
  const [newFreq, setNewFreq] = React.useState("weekly");
  const [templates, setTemplates] = React.useState<Record<string, Tpl>>({});
  const [overrides, setOverrides] = React.useState<Record<string, Record<string, { title?: string; body?: string }>>>({});
  const [reportScheds, setReportScheds] = React.useState<{ id: string; reportType: string; frequency: string; recipient: string; enabled: boolean; lastSentAt?: string }[]>([]);
  const [rType, setRType] = React.useState("sales");
  const [rFreq, setRFreq] = React.useState("weekly");
  const [rTo, setRTo] = React.useState("");
  const [deliveryLog, setDeliveryLog] = React.useState<{ id: string; at: string; reportType: string; recipientCount: number; recipients: string[]; status: string }[]>([]);
  const [msg, setMsg] = React.useState("");

  const loadExport = React.useCallback(async () => { const r = await doFetch("/api/admin/export-schedule"); if (r.ok) { const d = (await r.json()) as { schedules: Schedule[]; history: Run[] }; setSchedules(d.schedules); setHistory(d.history); } }, [doFetch]);
  const loadReports = React.useCallback(async () => { const r = await doFetch("/api/admin/report-schedule"); if (r.ok) setReportScheds(((await r.json()) as { schedules: typeof reportScheds }).schedules); }, [doFetch]);
  const loadLog = React.useCallback(async () => { const r = await doFetch("/api/admin/report-log"); if (r.ok) setDeliveryLog(((await r.json()) as { log: typeof deliveryLog }).log); }, [doFetch]);
  const loadTpl = React.useCallback(async () => { const r = await doFetch("/api/admin/notification-templates"); if (r.ok) { const d = (await r.json()) as { resolved: Record<string, Tpl>; overrides: typeof overrides }; setTemplates(d.resolved); setOverrides(d.overrides ?? {}); } }, [doFetch]);
  React.useEffect(() => { if (tab === "export") void loadExport(); else if (tab === "reports") void loadReports(); else if (tab === "log") void loadLog(); else void loadTpl(); }, [tab, loadExport, loadReports, loadLog, loadTpl]);

  const addSchedule = async () => { await doFetch("/api/admin/export-schedule", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "add", type: newType, frequency: newFreq }) }); await loadExport(); };
  const toggle = async (id: string, enabled: boolean) => { await doFetch("/api/admin/export-schedule", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "setEnabled", id, enabled }) }); await loadExport(); };
  const remove = async (id: string) => { await doFetch("/api/admin/export-schedule", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "remove", id }) }); await loadExport(); };

  const addReport = async () => { if (!rTo) { setMsg("宛先メールを入力してください"); return; } await doFetch("/api/admin/report-schedule", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "add", reportType: rType, frequency: rFreq, recipient: rTo }) }); setRTo(""); await loadReports(); };
  const toggleReport = async (id: string, enabled: boolean) => { await doFetch("/api/admin/report-schedule", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "setEnabled", id, enabled }) }); await loadReports(); };
  const removeReport = async (id: string) => { await doFetch("/api/admin/report-schedule", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "remove", id }) }); await loadReports(); };
  const setOverride = (event: string, locale: string, field: "title" | "body", value: string) => {
    setOverrides((o) => ({ ...o, [event]: { ...(o[event] ?? {}), [locale]: { ...((o[event] ?? {})[locale] ?? {}), [field]: value } } }));
  };
  const saveTpl = async () => { setMsg(""); const r = await doFetch("/api/admin/notification-templates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(overrides) }); if (r.ok) { setMsg("保存しました"); await loadTpl(); } };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-2xl font-bold">自動化</h1>
      <div className="mb-4 flex gap-1 border-b border-neutral-200">
        {[["export", "エクスポート予約"], ["reports", "レポート配信"], ["log", "配信ログ"], ["templates", "通知テンプレート"]].map(([k, l]) => <Button key={k} onClick={() => setTab(k!)} className={`px-3 py-2 text-sm ${tab === k ? "border-b-2 border-neutral-900 font-medium" : "text-neutral-500"}`}>{l}</Button>)}
      </div>
      {msg && <p className="mb-3 rounded bg-green-50 px-3 py-2 text-sm text-green-700">{msg}</p>}

      {tab === "export" && (
        <div>
          <div className="mb-4 flex items-end gap-2 rounded border border-neutral-200 p-3">
            <label className="text-xs text-neutral-500">種別<Select value={newType} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewType(e.target.value)} className="mt-0.5 block rounded border border-neutral-300 px-2 py-1 text-sm" options={[{ label: "バックアップ", value: "backup" }, { label: "取引先", value: "partners" }, { label: "請求", value: "invoices" }, { label: "監査ログ", value: "audit" }]} /></label>
            <label className="text-xs text-neutral-500">頻度<Select value={newFreq} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewFreq(e.target.value)} className="mt-0.5 block rounded border border-neutral-300 px-2 py-1 text-sm" options={[{ label: "毎日", value: "daily" }, { label: "毎週", value: "weekly" }, { label: "毎月", value: "monthly" }]} /></label>
            <Button onClick={addSchedule} className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white">追加</Button>
          </div>
          <ul className="mb-4 divide-y divide-neutral-100 rounded border border-neutral-200">
            {schedules.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span><span className={`mr-2 rounded px-1.5 py-0.5 text-xs ${s.enabled ? "bg-green-100 text-green-800" : "bg-neutral-200 text-neutral-600"}`}>{s.enabled ? "有効" : "停止"}</span>{TYPE_LABEL[s.type] ?? s.type} / {s.frequency === "daily" ? "毎日" : s.frequency === "weekly" ? "毎週" : "毎月"}{s.lastRunAt && <span className="ml-2 text-xs text-neutral-400">前回: {s.lastRunAt.slice(0, 10)}</span>}</span>
                <span className="flex gap-2 text-xs"><Button onClick={() => toggle(s.id, !s.enabled)} className="text-blue-600 hover:underline">{s.enabled ? "停止" : "有効化"}</Button><Button onClick={() => remove(s.id)} className="text-red-600 hover:underline">削除</Button></span>
              </li>
            ))}
            {schedules.length === 0 && <li className="px-3 py-4 text-center text-xs text-neutral-500">予約はありません。</li>}
          </ul>
          <h3 className="mb-1 text-sm font-medium">実行履歴</h3>
          <ul className="divide-y divide-neutral-100 rounded border border-neutral-200 text-xs">
            {history.map((h) => <li key={h.id} className="flex justify-between px-3 py-1.5"><span>{h.at.slice(0, 16).replace("T", " ")} {TYPE_LABEL[h.type] ?? h.type}</span><span className={h.status === "success" ? "text-green-600" : "text-red-600"}>{h.status === "success" ? `${h.recordCount}件` : "失敗"}</span></li>)}
            {history.length === 0 && <li className="px-3 py-4 text-center text-neutral-500">履歴はありません。cron から /api/admin/export-scan を実行してください。</li>}
          </ul>
        </div>
      )}

      {tab === "reports" && (
        <div>
          <p className="mb-2 text-xs text-neutral-500">定型レポートを定期生成し、宛先へメール＋受信箱で配信します。</p>
          <div className="mb-4 flex items-end gap-2 rounded border border-neutral-200 p-3">
            <label className="text-xs text-neutral-500">レポート<Select value={rType} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRType(e.target.value)} className="mt-0.5 block rounded border border-neutral-300 px-2 py-1 text-sm" options={[{ label: "売上", value: "sales" }, { label: "売掛", value: "receivables" }, { label: "在庫", value: "inventory" }]} /></label>
            <label className="text-xs text-neutral-500">頻度<Select value={rFreq} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRFreq(e.target.value)} className="mt-0.5 block rounded border border-neutral-300 px-2 py-1 text-sm" options={[{ label: "毎日", value: "daily" }, { label: "毎週", value: "weekly" }, { label: "毎月", value: "monthly" }]} /></label>
            <label className="flex-1 text-xs text-neutral-500">宛先（カンマ区切り / role:admin 等）<Input value={rTo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRTo(e.target.value)} placeholder="boss@example.com, role:finance" className="mt-0.5 block w-full rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
            <Button onClick={addReport} className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white">追加</Button>
          </div>
          <ul className="divide-y divide-neutral-100 rounded border border-neutral-200">
            {reportScheds.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span><span className={`mr-2 rounded px-1.5 py-0.5 text-xs ${s.enabled ? "bg-green-100 text-green-800" : "bg-neutral-200 text-neutral-600"}`}>{s.enabled ? "有効" : "停止"}</span>{RLABEL[s.reportType] ?? s.reportType}レポート / {s.frequency === "daily" ? "毎日" : s.frequency === "weekly" ? "毎週" : "毎月"} → {s.recipient}{s.lastSentAt && <span className="ml-2 text-xs text-neutral-400">前回: {s.lastSentAt.slice(0, 10)}</span>}</span>
                <span className="flex gap-2 text-xs"><Button onClick={() => toggleReport(s.id, !s.enabled)} className="text-blue-600 hover:underline">{s.enabled ? "停止" : "有効化"}</Button><Button onClick={() => removeReport(s.id)} className="text-red-600 hover:underline">削除</Button></span>
              </li>
            ))}
            {reportScheds.length === 0 && <li className="px-3 py-4 text-center text-xs text-neutral-500">配信予約はありません。cron から /api/admin/report-scan を実行してください。</li>}
          </ul>
        </div>
      )}

      {tab === "log" && (
        <div>
          <p className="mb-2 text-xs text-neutral-500">レポート配信の実行履歴です（いつ・何を・誰に）。</p>
          <ul className="divide-y divide-neutral-100 rounded border border-neutral-200 text-xs">
            {deliveryLog.map((d) => (
              <li key={d.id} className="px-3 py-2">
                <div className="flex justify-between">
                  <span className="font-medium">{d.at.slice(0, 16).replace("T", " ")} {RLABEL[d.reportType] ?? d.reportType}レポート</span>
                  <span className={d.status === "sent" ? "text-green-600" : "text-neutral-400"}>{d.status === "sent" ? `${d.recipientCount}名に配信` : "宛先なし"}</span>
                </div>
                {d.recipients.length > 0 && <div className="mt-0.5 truncate text-neutral-400">{d.recipients.join(", ")}</div>}
              </li>
            ))}
            {deliveryLog.length === 0 && <li className="px-3 py-4 text-center text-neutral-500">配信ログはありません。cron から /api/admin/report-scan を実行すると記録されます。</li>}
          </ul>
        </div>
      )}

      {tab === "templates" && (
        <div>
          <p className="mb-2 text-xs text-neutral-500">通知文面を編集します（空欄は既定を使用）。<code>{'{{var}}'}</code> は変数です。</p>
          {Object.values(templates).map((tpl) => (
            <div key={tpl.event} className="mb-4 rounded border border-neutral-200 p-3">
              <p className="mb-2 text-sm font-medium"><code>{tpl.event}</code></p>
              {(["ja", "en", "zh", "ko"] as const).map((loc) => (
                <div key={loc} className="mb-2">
                  <p className="text-xs text-neutral-400">{loc}</p>
                  <Input defaultValue={tpl.locales[loc]?.title ?? ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOverride(tpl.event, loc, "title", e.target.value)} placeholder="タイトル" className="mb-1 block w-full rounded border border-neutral-300 px-2 py-1 text-xs" />
                  <Input defaultValue={tpl.locales[loc]?.body ?? ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOverride(tpl.event, loc, "body", e.target.value)} placeholder="本文" className="block w-full rounded border border-neutral-300 px-2 py-1 text-xs" />
                </div>
              ))}
            </div>
          ))}
          <Button onClick={saveTpl} className="rounded bg-neutral-900 px-6 py-2 text-sm text-white">保存</Button>
        </div>
      )}
    </div>
  );
}
