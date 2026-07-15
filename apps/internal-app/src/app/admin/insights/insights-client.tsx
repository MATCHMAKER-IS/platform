"use client";
/** 管理: 利用状況ダッシュボード・設定変更履歴・送信Webhook購読を1画面に集約。 */
import * as React from "react";

interface Count { key: string; count: number; }
interface Usage { totalEvents: number; activeUsers: number; byFeature: Count[]; byActor: Count[]; byAction: Count[]; }
interface Change { actor: string; action: string; target?: string; at?: string; }
interface Sub { id: string; url: string; events: string[]; active: boolean; createdAt: string; }

export function InsightsClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [tab, setTab] = React.useState("usage");
  const [usage, setUsage] = React.useState<Usage | null>(null);
  const [changes, setChanges] = React.useState<Change[] | null>(null);
  const [subs, setSubs] = React.useState<Sub[] | null>(null);
  const [form, setForm] = React.useState({ url: "", events: "invoice.created", secret: "" });
  const [msg, setMsg] = React.useState("");

  const loadUsage = React.useCallback(async () => { const r = await doFetch("/api/admin/usage"); if (r.ok) setUsage(((await r.json()) as { usage: Usage }).usage); }, [doFetch]);
  const loadChanges = React.useCallback(async () => { const r = await doFetch("/api/admin/config-changes"); if (r.ok) setChanges(((await r.json()) as { changes: Change[] }).changes); }, [doFetch]);
  const loadSubs = React.useCallback(async () => { const r = await doFetch("/api/admin/webhooks"); if (r.ok) setSubs(((await r.json()) as { subscriptions: Sub[] }).subscriptions); }, [doFetch]);
  React.useEffect(() => {
    if (tab === "usage" && !usage) void loadUsage();
    if (tab === "changes" && !changes) void loadChanges();
    if (tab === "webhooks" && !subs) void loadSubs();
  }, [tab, usage, changes, subs, loadUsage, loadChanges, loadSubs]);

  const addSub = async () => {
    setMsg("");
    const events = form.events.split(",").map((e) => e.trim()).filter(Boolean);
    const r = await doFetch("/api/admin/webhooks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "add", url: form.url, events, secret: form.secret }) });
    if (r.ok) { setForm({ url: "", events: "invoice.created", secret: "" }); await loadSubs(); } else setMsg(((await r.json()) as { error?: string }).error ?? "追加に失敗しました");
  };
  const setActive = async (id: string, active: boolean) => { await doFetch("/api/admin/webhooks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "setActive", id, active }) }); await loadSubs(); };
  const remove = async (id: string) => { await doFetch("/api/admin/webhooks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "remove", id }) }); await loadSubs(); };

  const bars = (c: Count[]) => { const max = Math.max(1, ...c.map((x) => x.count)); return c.slice(0, 12).map((x) => (
    <div key={x.key} className="flex items-center gap-2 text-xs"><span className="w-40 truncate text-neutral-600">{x.key}</span><span className="h-3 rounded bg-blue-500" style={{ width: `${(x.count / max) * 60}%` }}></span><span className="text-neutral-500">{x.count}</span></div>
  )); };
  const TABS = [["usage", "利用状況"], ["changes", "設定変更履歴"], ["webhooks", "送信Webhook"]];

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-2xl font-bold">利用状況・設定履歴・Webhook</h1>
      <div className="mb-4 flex gap-1 border-b border-neutral-200">
        {TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k!)} className={`px-3 py-2 text-sm ${tab === k ? "border-b-2 border-neutral-900 font-medium" : "text-neutral-500"}`}>{l}</button>)}
      </div>

      {tab === "usage" && usage && (
        <div className="rounded border border-neutral-200 p-4">
          <div className="mb-3 flex gap-3">
            <div className="rounded bg-neutral-50 px-3 py-2 text-center"><div className="text-xs text-neutral-500">総イベント</div><div className="text-lg font-bold">{usage.totalEvents}</div></div>
            <div className="rounded bg-neutral-50 px-3 py-2 text-center"><div className="text-xs text-neutral-500">アクティブ利用者</div><div className="text-lg font-bold">{usage.activeUsers}</div></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><h3 className="mb-1 text-xs font-medium text-neutral-500">機能別</h3><div className="space-y-1">{bars(usage.byFeature)}</div></div>
            <div><h3 className="mb-1 text-xs font-medium text-neutral-500">利用者別</h3><div className="space-y-1">{bars(usage.byActor)}</div></div>
          </div>
        </div>
      )}

      {tab === "changes" && changes && (
        <div className="rounded border border-neutral-200 p-4">
          <h2 className="mb-2 text-sm font-medium">設定・管理操作の変更履歴（直近100件）</h2>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-neutral-200 text-left text-xs text-neutral-500"><th className="px-2 py-1">日時</th><th className="px-2 py-1">操作者</th><th className="px-2 py-1">操作</th><th className="px-2 py-1">対象</th></tr></thead>
            <tbody>{changes.map((c, i) => <tr key={i} className="border-b border-neutral-100"><td className="px-2 py-1.5 text-xs">{(c.at ?? "").replace("T", " ").slice(0, 16)}</td><td className="px-2 py-1.5">{c.actor}</td><td className="px-2 py-1.5">{c.action}</td><td className="px-2 py-1.5 text-xs text-neutral-500">{c.target ?? "—"}</td></tr>)}</tbody>
          </table>
          {changes.length === 0 && <p className="text-xs text-neutral-500">変更履歴はまだありません。</p>}
        </div>
      )}

      {tab === "webhooks" && subs && (
        <div className="rounded border border-neutral-200 p-4">
          <h2 className="mb-2 text-sm font-medium">送信Webhook（イベントを外部URLへ署名付きで配信）</h2>
          {msg && <p className="mb-2 text-xs text-red-600">{msg}</p>}
          <div className="mb-3 grid grid-cols-3 gap-2">
            <input value={form.url} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, url: e.target.value })} placeholder="https://example.com/hook" className="rounded border border-neutral-300 px-2 py-1 text-sm" />
            <input value={form.events} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, events: e.target.value })} placeholder="invoice.created,* " className="rounded border border-neutral-300 px-2 py-1 text-sm" />
            <div className="flex gap-1"><input value={form.secret} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, secret: e.target.value })} placeholder="署名secret" className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm" /><button onClick={addSub} className="rounded bg-neutral-900 px-3 py-1 text-sm text-white">追加</button></div>
          </div>
          <ul className="space-y-1">
            {subs.map((s) => (
              <li key={s.id} className="flex items-center justify-between border-b border-neutral-100 py-1.5 text-sm">
                <span><span className={`mr-2 rounded px-1.5 py-0.5 text-xs ${s.active ? "bg-green-100 text-green-800" : "bg-neutral-200 text-neutral-600"}`}>{s.active ? "有効" : "停止"}</span>{s.url} <span className="text-xs text-neutral-400">[{s.events.join(", ")}]</span></span>
                <span className="flex gap-2 text-xs"><button onClick={() => setActive(s.id, !s.active)} className="text-blue-600 hover:underline">{s.active ? "停止" : "有効化"}</button><button onClick={() => remove(s.id)} className="text-red-600 hover:underline">削除</button></span>
              </li>
            ))}
            {subs.length === 0 && <li className="text-xs text-neutral-500">購読はありません。</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
