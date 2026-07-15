"use client";
/** 機能アクセス設定。各機能の有効/無効と、使える役割を管理者が設定する（表示/非表示に反映）。 */
import * as React from "react";

interface Feature { key: string; label: string; href: string; }
interface Rule { enabled: boolean; roles: string[]; }
const ROLES = ["employee", "editor", "manager", "finance", "admin"];
const ROLE_LABEL: Record<string, string> = { employee: "一般", editor: "編集", manager: "管理者", finance: "経理", admin: "管理" };

export function FeaturesClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [catalog, setCatalog] = React.useState<Feature[]>([]);
  const [rules, setRules] = React.useState<Record<string, Rule>>({});
  const [msg, setMsg] = React.useState("");

  const load = React.useCallback(async () => {
    const r = await doFetch("/api/admin/features");
    if (r.ok) { const d = (await r.json()) as { catalog: Feature[]; rules: Record<string, Rule> }; setCatalog(d.catalog); setRules(d.rules); }
  }, [doFetch]);
  React.useEffect(() => { void load(); }, [load]);

  const toggleEnabled = (key: string) => setRules((rs) => ({ ...rs, [key]: { ...rs[key]!, enabled: !rs[key]!.enabled } }));
  const toggleRole = (key: string, role: string) => setRules((rs) => { const cur = rs[key]!; const roles = cur.roles.includes(role) ? cur.roles.filter((r) => r !== role) : [...cur.roles, role]; return { ...rs, [key]: { ...cur, roles } }; });

  const save = async () => {
    setMsg("");
    const r = await doFetch("/api/admin/features", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(rules) });
    if (r.ok) { setMsg("保存しました。各利用者のナビ表示に反映されます。"); await load(); }
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-2xl font-bold">機能アクセス設定</h1>
      <p className="mb-4 text-xs text-neutral-500">機能ごとに有効/無効と、使える役割を設定します。役割を指定しない場合は全役割が対象です。管理者は常に全機能を使えます。</p>
      {msg && <p className="mb-3 rounded bg-green-50 px-3 py-2 text-sm text-green-700">{msg}</p>}
      <div className="overflow-x-auto rounded border border-neutral-200">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-neutral-200 text-xs text-neutral-500"><th className="px-3 py-2 text-left">機能</th><th className="px-2 py-2">有効</th>{ROLES.map((r) => <th key={r} className="px-2 py-2">{ROLE_LABEL[r]}</th>)}</tr></thead>
          <tbody>
            {catalog.map((f) => {
              const rule = rules[f.key];
              if (!rule) return null;
              return (
                <tr key={f.key} className={`border-b border-neutral-100 ${rule.enabled ? "" : "bg-neutral-50 opacity-60"}`}>
                  <td className="px-3 py-2">{f.label}<span className="ml-1 text-xs text-neutral-400">{f.href}</span></td>
                  <td className="px-2 py-2 text-center"><input type="checkbox" checked={rule.enabled} onChange={() => toggleEnabled(f.key)} /></td>
                  {ROLES.map((role) => (
                    <td key={role} className="px-2 py-2 text-center">
                      {role === "admin" ? <span className="text-xs text-neutral-400">常に可</span> : <input type="checkbox" disabled={!rule.enabled} checked={rule.roles.length === 0 || rule.roles.includes(role)} onChange={() => toggleRole(f.key, role)} />}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-neutral-400">役割の列にチェックが無い＝その役割は非表示（使用不可）。全て空＝全役割に表示。</p>
      <button onClick={save} className="mt-4 rounded bg-neutral-900 px-6 py-2 text-sm text-white">保存</button>
    </div>
  );
}
