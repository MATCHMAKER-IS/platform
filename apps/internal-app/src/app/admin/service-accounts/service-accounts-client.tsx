"use client";
/** APIキー（サービスアカウント）管理。外部システム連携用の鍵を発行・失効する。平文キーは発行直後のみ表示。 */
import * as React from "react";
import { Button, Checkbox, Input } from "@platform/ui";

interface Account { id: string; name: string; displayPrefix: string; scopes: string[]; active: boolean; createdAt: string; }
const SCOPE_OPTIONS = ["invoice:read", "invoice:write", "partner:read", "accounting:read", "inventory:read"];

export function ServiceAccountsClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [name, setName] = React.useState("");
  const [scopes, setScopes] = React.useState<string[]>(["invoice:read"]);
  const [issued, setIssued] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState("");

  const reload = React.useCallback(async () => { const r = await doFetch("/api/admin/service-accounts"); if (r.ok) setAccounts(((await r.json()) as { accounts: Account[] }).accounts); }, [doFetch]);
  React.useEffect(() => { void reload(); }, [reload]);

  const toggleScope = (s: string) => setScopes((cur) => cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]);
  const create = async () => {
    setMsg(""); setIssued(null);
    if (!name || scopes.length === 0) { setMsg("名前とスコープを指定してください"); return; }
    const r = await doFetch("/api/admin/service-accounts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "create", name, scopes }) });
    if (r.ok) { const d = (await r.json()) as { plaintext: string }; setIssued(d.plaintext); setName(""); setScopes(["invoice:read"]); await reload(); }
    else setMsg(((await r.json()) as { error?: string }).error ?? "発行に失敗しました");
  };
  const setActive = async (id: string, active: boolean) => {
    await doFetch("/api/admin/service-accounts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "setActive", id, active }) });
    await reload();
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-2xl font-bold">APIキー（サービスアカウント）</h1>
      <p className="mb-4 text-xs text-[var(--color-muted)]">外部システムやスクリプトが Bearer トークンで社内APIを呼ぶための鍵です。平文キーは発行直後の一度だけ表示されます。</p>

      {issued && (
        <div className="mb-4 rounded border border-[color-mix(in_srgb,var(--color-warning)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_8%,transparent)] p-3">
          <p className="text-sm font-medium text-[var(--color-warning)]">キーを発行しました（この画面を離れると再表示できません）:</p>
          <code className="mt-1 block break-all rounded bg-white px-2 py-1 text-sm">{issued}</code>
        </div>
      )}
      {msg && <p className="mb-3 text-sm text-[var(--color-danger)]">{msg}</p>}

      <div className="mb-6 rounded border border-[var(--color-border)] p-4">
        <label className="text-xs text-[var(--color-muted)]">名前<Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="例: 経費精算バッチ" className="mt-0.5 mb-3 block w-full rounded border border-[var(--color-border)] px-2 py-1 text-sm" /></label>
        <p className="mb-1 text-xs text-[var(--color-muted)]">スコープ（権限）</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {SCOPE_OPTIONS.map((s) => <label key={s} className="flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-xs"><Checkbox  checked={scopes.includes(s)} onCheckedChange={() => toggleScope(s)} />{s}</label>)}
        </div>
        <Button onClick={create} className="rounded bg-[var(--color-fg)] px-4 py-2 text-sm text-white">キーを発行</Button>
      </div>

      <div className="divide-y divide-neutral-100 rounded border border-[var(--color-border)]">
        {accounts.map((a) => (
          <div key={a.id} className="flex items-center justify-between px-3 py-2">
            <div>
              <p className="text-sm font-medium">{a.name} <span className={`ml-1 rounded px-1.5 py-0.5 text-xs ${a.active ? "bg-[color-mix(in_srgb,var(--color-success)_15%,transparent)] text-[var(--color-success)]" : "bg-[var(--color-subtle-strong)] text-[var(--color-muted)]"}`}>{a.active ? "有効" : "失効"}</span></p>
              <p className="text-xs text-[var(--color-muted)]"><code>{a.displayPrefix}…</code> [{a.scopes.join(", ")}]</p>
            </div>
            <Button onClick={() => setActive(a.id, !a.active)} className="text-xs text-[var(--color-primary)] hover:underline">{a.active ? "失効させる" : "再有効化"}</Button>
          </div>
        ))}
        {accounts.length === 0 && <p className="px-3 py-6 text-center text-sm text-[var(--color-muted)]">APIキーはありません。</p>}
      </div>
    </div>
  );
}
