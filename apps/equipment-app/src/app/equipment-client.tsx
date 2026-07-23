"use client";
/** 備品管理。ログイン → 一覧(貸出状態) → 登録・貸出・返却・編集・無効化。 */
import * as React from "react";
import { Button, Input, Checkbox } from "@platform/ui";

interface Item { code: string; name: string; note?: string; active: boolean; currentBorrower?: string; }
interface FieldError { field: string; message: string; }

export function EquipmentClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [authed, setAuthed] = React.useState<{ email: string; name?: string } | null>(null);
  const [needLogin, setNeedLogin] = React.useState(false);
  const [email, setEmail] = React.useState("admin@example.com");
  const [password, setPassword] = React.useState("");
  const [loginError, setLoginError] = React.useState("");
  const [items, setItems] = React.useState<Item[]>([]);
  const [showInactive, setShowInactive] = React.useState(false);
  const [form, setForm] = React.useState({ code: "", name: "", note: "" });
  const [errors, setErrors] = React.useState<FieldError[]>([]);
  const [opError, setOpError] = React.useState("");
  const [lendCode, setLendCode] = React.useState<string | null>(null);
  const [borrower, setBorrower] = React.useState("");
  const [editing, setEditing] = React.useState<string | null>(null);
  const [edit, setEdit] = React.useState({ name: "", note: "" });

  const load = React.useCallback(async () => {
    const r = await doFetch(`/api/equipment${showInactive ? "?includeInactive=1" : ""}`);
    if (r.status === 401) { setNeedLogin(true); setAuthed(null); return; }
    if (r.ok) {
      const d = (await r.json()) as { items: Item[]; user: { email: string; name?: string } };
      setItems(d.items); setAuthed(d.user); setNeedLogin(false);
    }
  }, [doFetch, showInactive]);
  React.useEffect(() => { void load(); }, [load]);

  const doLogin = async () => {
    setLoginError("");
    const r = await doFetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
    if (r.ok) { setPassword(""); await load(); }
    else setLoginError(((await r.json()) as { error?: string }).error ?? "ログインに失敗しました");
  };
  const doLogout = async () => { await doFetch("/api/auth/logout", { method: "POST" }); setNeedLogin(true); setAuthed(null); };

  const err = (field: string) => errors.find((e) => e.field === field)?.message;
  const add = async () => {
    setErrors([]); setOpError("");
    const r = await doFetch("/api/equipment", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    if (r.ok) { setForm({ code: "", name: "", note: "" }); await load(); }
    else setErrors(((await r.json()) as { errors?: FieldError[] }).errors ?? []);
  };
  const saveEdit = async (code: string) => {
    setErrors([]);
    const r = await doFetch(`/api/equipment/${code}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(edit) });
    if (r.ok) { setEditing(null); await load(); }
    else setErrors(((await r.json()) as { errors?: FieldError[] }).errors ?? []);
  };
  const toggle = async (code: string, active: boolean) => {
    await doFetch(`/api/equipment/${code}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ active }) });
    await load();
  };
  const lend = async (code: string) => {
    setOpError("");
    const r = await doFetch(`/api/equipment/${code}/lend`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ borrower }) });
    if (r.ok) { setLendCode(null); setBorrower(""); await load(); }
    else setOpError(((await r.json()) as { error?: string }).error ?? "貸出に失敗しました");
  };
  const giveBack = async (code: string) => {
    setOpError("");
    const r = await doFetch(`/api/equipment/${code}/return`, { method: "POST" });
    if (r.ok) await load();
    else setOpError(((await r.json()) as { error?: string }).error ?? "返却に失敗しました");
  };

  if (needLogin) {
    return (
      <div style={{ maxWidth: 360, margin: "80px auto", padding: 24, border: "1px solid #e5e5e5", borderRadius: 8 }}>
        <h1 style={{ fontSize: 18, marginTop: 0 }}>備品管理にログイン</h1>
        <label style={{ display: "block", fontSize: 12, color: "var(--color-muted)", marginBottom: 8 }}>メール<Input value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} /></label>
        <label style={{ display: "block", fontSize: 12, color: "var(--color-muted)", marginBottom: 8 }}>パスワード<Input type="password" value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} placeholder="初期: admin1234" /></label>
        {loginError && <p style={{ color: "var(--color-danger)", fontSize: 12 }}>{loginError}</p>}
        <Button onClick={doLogin} style={{ width: "100%" }}>ログイン</Button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid #e5e5e5", paddingBottom: 8 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>備品管理</h1>
        <span style={{ fontSize: 12, color: "var(--color-muted)" }}>{authed?.name ?? authed?.email} <Button size="sm" variant="ghost" onClick={doLogout} style={{ marginLeft: 8 }}>ログアウト</Button></span>
      </div>

      <div style={{ border: "1px solid #e5e5e5", borderRadius: 6, padding: 12, margin: "16px 0" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <label style={{ flex: 1, fontSize: 12, color: "var(--color-muted)" }}>コード<Input value={form.code} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, code: e.target.value })} placeholder="EQ-001" /></label>
          <label style={{ flex: 1, fontSize: 12, color: "var(--color-muted)" }}>名称<Input value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, name: e.target.value })} /></label>
          <label style={{ flex: 1, fontSize: 12, color: "var(--color-muted)" }}>備考<Input value={form.note} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, note: e.target.value })} /></label>
          <Button onClick={add}>登録</Button>
        </div>
        {errors.length > 0 && <ul style={{ color: "#c00", fontSize: 12, marginTop: 8 }}>{errors.map((e, i) => <li key={i}>{e.field}: {e.message}</li>)}</ul>}
      </div>

      {opError && <p style={{ color: "var(--color-danger)", fontSize: 12 }}>{opError}</p>}
      <label style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}><Checkbox checked={showInactive} onCheckedChange={(v) => setShowInactive(v === true)} /> 無効も表示</label>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
        <thead><tr style={{ borderBottom: "1px solid #ddd", textAlign: "left", color: "#666", fontSize: 12 }}><th style={{ padding: 6 }}>コード</th><th>名称</th><th>状態</th><th></th></tr></thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.code} style={{ borderBottom: "1px solid #f0f0f0", opacity: it.active ? 1 : 0.5 }}>
              <td style={{ padding: 6 }}><code>{it.code}</code></td>
              {editing === it.code ? (
                <>
                  <td><Input value={edit.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEdit({ ...edit, name: e.target.value })} /></td>
                  <td colSpan={2}><Button size="sm" onClick={() => void saveEdit(it.code)}>保存</Button> <Button size="sm" variant="secondary" onClick={() => setEditing(null)}>取消</Button></td>
                </>
              ) : (
                <>
                  <td>{it.name}{it.note && <span style={{ color: "#999", fontSize: 12 }}>（{it.note}）</span>}</td>
                  <td>{!it.active ? "無効" : it.currentBorrower ? <span style={{ color: "#b45309" }}>貸出中: {it.currentBorrower}</span> : "在庫あり"}</td>
                  <td style={{ textAlign: "right" }}>
                    {it.active && !it.currentBorrower && (lendCode === it.code ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Input value={borrower} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBorrower(e.target.value)} placeholder="借用者名" style={{ width: 110 }} /> <Button size="sm" onClick={() => void lend(it.code)}>確定</Button> <Button size="sm" variant="ghost" onClick={() => { setLendCode(null); setBorrower(""); }}>×</Button></span>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => { setLendCode(it.code); setBorrower(""); }}>貸出</Button>
                    ))}
                    {it.active && it.currentBorrower && <Button size="sm" onClick={() => void giveBack(it.code)}>返却</Button>}{" "}
                    <Button size="sm" variant="secondary" onClick={() => { setEditing(it.code); setEdit({ name: it.name, note: it.note ?? "" }); }}>編集</Button>{" "}
                    <Button size="sm" variant="ghost" onClick={() => void toggle(it.code, !it.active)}>{it.active ? "無効化" : "有効化"}</Button>
                  </td>
                </>
              )}
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={4} style={{ padding: 16, textAlign: "center", color: "#999" }}>備品がありません。上のフォームから登録してください。</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
