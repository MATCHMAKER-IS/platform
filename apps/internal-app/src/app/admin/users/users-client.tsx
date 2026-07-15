"use client";
/** 管理画面: ユーザー・権限ディレクトリ。利用者の追加・ロール割当・有効/無効を管理する。 */
import * as React from "react";

interface User { email: string; name: string; department: string; roles: string[]; permissions: string[]; active: boolean; createdAt: string; passwordSetAt?: string; }
interface Perm { key: string; label: string; }
const ROLE_LABEL: Record<string, string> = { employee: "一般", editor: "編集", manager: "管理者", finance: "経理", admin: "システム管理" };

export interface UsersClientProps { fetchImpl?: typeof fetch; }

export function UsersClient({ fetchImpl }: UsersClientProps) {
  const [users, setUsers] = React.useState<User[]>([]);
  const [roles, setRoles] = React.useState<string[]>([]);
  const [perms, setPerms] = React.useState<Perm[]>([]);
  const [form, setForm] = React.useState<{ email: string; name: string; department: string; roles: string[]; permissions: string[] }>({ email: "", name: "", department: "", roles: [], permissions: [] });
  const [tempPw, setTempPw] = React.useState<{ email: string; password: string } | null>(null);
  const [msg, setMsg] = React.useState("");
  const [error, setError] = React.useState("");
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const reload = React.useCallback(async () => {
    const res = await doFetch("/api/admin/users");
    if (res.ok) { const d = (await res.json()) as { users: User[]; roles: string[]; permissions: Perm[] }; setUsers(d.users); setRoles(d.roles); setPerms(d.permissions); }
    else setError("管理者権限が必要です。");
  }, [doFetch]);
  React.useEffect(() => { void reload(); }, [reload]);

  const toggleRole = (r: string) => setForm((f) => ({ ...f, roles: f.roles.includes(r) ? f.roles.filter((x) => x !== r) : [...f.roles, r] }));
  const togglePerm = (pkey: string) => setForm((f) => ({ ...f, permissions: f.permissions.includes(pkey) ? f.permissions.filter((x) => x !== pkey) : [...f.permissions, pkey] }));

  const save = async () => {
    setMsg(""); setError("");
    if (!form.email) { setError("メールアドレスを入力してください。"); return; }
    const res = await doFetch("/api/admin/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: form.email, name: form.name || form.email, department: form.department, roles: form.roles, permissions: form.permissions }) });
    if (res.ok) { setMsg(`${form.email} を保存しました`); setForm({ email: "", name: "", department: "", roles: [], permissions: [] }); await reload(); }
    else setError(((await res.json()) as { error?: string }).error ?? "保存に失敗しました");
  };

  const edit = (u: User) => setForm({ email: u.email, name: u.name, department: u.department, roles: [...u.roles], permissions: [...u.permissions] });
  const reissue = async (email: string) => {
    const res = await doFetch("/api/admin/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, reissuePassword: true }) });
    if (res.ok) { const d = (await res.json()) as { temporaryPassword: string }; setTempPw({ email, password: d.temporaryPassword }); }
  };
  const setActive = async (email: string, active: boolean) => {
    await doFetch("/api/admin/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, setActive: active }) });
    await reload();
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-2xl font-bold">ユーザー・権限管理</h1>
      <p className="mb-4 text-xs text-neutral-500">利用者とロールを管理します。認可はここで付与したロールに基づきます。</p>
      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {msg && <p className="mb-3 rounded bg-green-50 px-3 py-2 text-sm text-green-700">{msg}</p>}
      {tempPw && (
        <div className="mb-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
          <p className="text-amber-800">{tempPw.email} の一時パスワード（この画面でのみ表示。控えて本人へ伝えてください）:</p>
          <p className="mt-1 font-mono text-base font-bold text-neutral-900">{tempPw.password}</p>
          <button onClick={() => setTempPw(null)} className="mt-1 text-xs text-neutral-500 hover:underline">閉じる</button>
        </div>
      )}

      <div className="mb-6 rounded border border-neutral-200 p-4">
        <h2 className="mb-2 text-sm font-medium">ユーザーを追加 / 編集</h2>
        <div className="flex flex-col gap-2">
          <label className="text-xs text-neutral-500">メールアドレス<input value={form.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, email: e.target.value })} className="mt-0.5 block w-full rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
          <label className="text-xs text-neutral-500">氏名<input value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, name: e.target.value })} className="mt-0.5 block w-full rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
          <label className="text-xs text-neutral-500">部門<input value={form.department} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, department: e.target.value })} placeholder="営業部 / 経理部 など" className="mt-0.5 block w-full rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
          <div className="text-xs text-neutral-500">ロール
            <div className="mt-1 flex flex-wrap gap-2">
              {roles.map((r) => (
                <button key={r} onClick={() => toggleRole(r)} className={`rounded border px-2 py-1 text-xs ${form.roles.includes(r) ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-600"}`}>{ROLE_LABEL[r] ?? r}</button>
              ))}
            </div>
          </div>
          <div className="text-xs text-neutral-500">個別権限（ロールに追加で付与）
            <div className="mt-1 flex flex-wrap gap-1">
              {perms.map((p) => (
                <button key={p.key} onClick={() => togglePerm(p.key)} className={`rounded border px-2 py-0.5 text-xs ${form.permissions.includes(p.key) ? "border-blue-600 bg-blue-600 text-white" : "border-neutral-300 text-neutral-600"}`}>{p.label}</button>
              ))}
            </div>
          </div>
          <button onClick={save} className="mt-1 self-start rounded bg-neutral-900 px-4 py-1.5 text-sm text-white">保存</button>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead><tr className="border-b border-neutral-200 text-left text-xs text-neutral-500"><th className="px-2 py-1">メール</th><th className="px-2 py-1">氏名</th><th className="px-2 py-1">部門</th><th className="px-2 py-1">ロール</th><th className="px-2 py-1">状態</th><th className="px-2 py-1"></th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.email} className="border-b border-neutral-100">
              <td className="px-2 py-1.5">{u.email}</td>
              <td className="px-2 py-1.5">{u.name}</td>
              <td className="px-2 py-1.5">{u.department || "—"}</td>
              <td className="px-2 py-1.5">{u.roles.map((r) => ROLE_LABEL[r] ?? r).join("・") || "—"}{u.permissions.length > 0 && <span className="ml-1 text-xs text-blue-600">+{u.permissions.length}権限</span>}</td>
              <td className="px-2 py-1.5">{u.active ? <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800">有効</span> : <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-xs text-neutral-600">無効</span>}</td>
              <td className="px-2 py-1.5 text-right"><span className="flex justify-end gap-2"><button onClick={() => edit(u)} className="text-blue-600 hover:underline">編集</button><button onClick={() => reissue(u.email)} className="text-amber-700 hover:underline">パスワード再発行</button><button onClick={() => setActive(u.email, !u.active)} className="text-neutral-500 hover:underline">{u.active ? "無効化" : "有効化"}</button></span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
