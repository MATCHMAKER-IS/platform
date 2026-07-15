"use client";
/** 初期セットアップウィザード。管理者不在時に最初の管理者作成＋会社設定を行う。 */
import * as React from "react";

interface State { initialized: boolean; canCreateFirstAdmin: boolean; steps: { admin: boolean; company: boolean }; }

export function SetupClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [state, setState] = React.useState<State | null>(null);
  const [form, setForm] = React.useState({ email: "", name: "", password: "", companyName: "" });
  const [msg, setMsg] = React.useState("");
  const [done, setDone] = React.useState(false);

  React.useEffect(() => { (async () => { const r = await doFetch("/api/setup/status"); if (r.ok) setState((await r.json()) as State); })(); }, [doFetch]);

  const submit = async () => {
    setMsg("");
    if (!form.email || !form.name || !form.password || !form.companyName) { setMsg("すべての項目を入力してください"); return; }
    if (form.password.length < 8) { setMsg("パスワードは8文字以上にしてください"); return; }
    const r = await doFetch("/api/setup/bootstrap", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    if (r.ok) setDone(true);
    else setMsg(((await r.json()) as { error?: string }).error ?? "セットアップに失敗しました");
  };

  if (!state) return <div className="mx-auto max-w-md p-6 text-sm text-neutral-500">確認中…</div>;
  if (done || state.initialized) return (
    <div className="mx-auto max-w-md p-6">
      <div className="rounded bg-green-50 p-4 text-green-800">
        <p className="font-semibold">セットアップ完了</p>
        <p className="mt-1 text-sm">管理者アカウントで <a href="/login" className="underline">ログイン</a> してください。</p>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-1 text-2xl font-bold">初期セットアップ</h1>
      <p className="mb-4 text-sm text-neutral-600">最初の管理者アカウントと会社情報を設定します。</p>
      {msg && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{msg}</p>}
      <div className="space-y-3">
        <label className="block text-xs text-neutral-500">会社名<input value={form.companyName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, companyName: e.target.value })} className="mt-0.5 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm" /></label>
        <label className="block text-xs text-neutral-500">管理者名<input value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, name: e.target.value })} className="mt-0.5 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm" /></label>
        <label className="block text-xs text-neutral-500">メールアドレス<input type="email" value={form.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, email: e.target.value })} className="mt-0.5 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm" /></label>
        <label className="block text-xs text-neutral-500">パスワード（8文字以上）<input type="password" value={form.password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, password: e.target.value })} className="mt-0.5 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm" /></label>
      </div>
      <button onClick={submit} className="mt-4 w-full rounded bg-neutral-900 px-6 py-2.5 text-sm text-white">セットアップを完了</button>
    </div>
  );
}
