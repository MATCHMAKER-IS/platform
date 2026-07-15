"use client";
/** 品目マスタの CRUD 画面。一覧・登録・編集・無効化(ソフトデリート)を1画面で。 */
import * as React from "react";

interface Item { code: string; name: string; note?: string; active: boolean; }
interface FieldError { field: string; message: string; }

export function ItemsClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [items, setItems] = React.useState<Item[]>([]);
  const [showInactive, setShowInactive] = React.useState(false);
  const [form, setForm] = React.useState({ code: "", name: "", note: "" });
  const [errors, setErrors] = React.useState<FieldError[]>([]);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [edit, setEdit] = React.useState({ name: "", note: "" });

  const load = React.useCallback(async () => {
    const r = await doFetch(`/api/items${showInactive ? "?includeInactive=1" : ""}`);
    if (r.ok) setItems(((await r.json()) as { items: Item[] }).items);
  }, [doFetch, showInactive]);
  React.useEffect(() => { void load(); }, [load]);

  const err = (field: string) => errors.find((e) => e.field === field)?.message;

  const add = async () => {
    setErrors([]);
    const r = await doFetch("/api/items", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    if (r.ok) { setForm({ code: "", name: "", note: "" }); await load(); }
    else setErrors(((await r.json()) as { errors?: FieldError[] }).errors ?? []);
  };
  const saveEdit = async (code: string) => {
    setErrors([]);
    const r = await doFetch(`/api/items/${code}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(edit) });
    if (r.ok) { setEditing(null); await load(); }
    else setErrors(((await r.json()) as { errors?: FieldError[] }).errors ?? []);
  };
  const toggle = async (code: string, active: boolean) => {
    await doFetch(`/api/items/${code}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ active }) });
    await load();
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 20 }}>品目マスタ</h1>

      <div style={{ border: "1px solid #e5e5e5", borderRadius: 6, padding: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <label style={{ fontSize: 12, color: "#666" }}>コード<input value={form.code} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, code: e.target.value })} placeholder="ITEM-001" style={{ display: "block", padding: 4 }} /></label>
          <label style={{ fontSize: 12, color: "#666" }}>名称<input value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, name: e.target.value })} style={{ display: "block", padding: 4 }} /></label>
          <label style={{ flex: 1, fontSize: 12, color: "#666" }}>備考<input value={form.note} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, note: e.target.value })} style={{ display: "block", width: "100%", padding: 4 }} /></label>
          <button onClick={add} style={{ alignSelf: "flex-end", padding: "6px 16px" }}>登録</button>
        </div>
        {errors.length > 0 && <ul style={{ color: "#c00", fontSize: 12, marginTop: 8 }}>{errors.map((e, i) => <li key={i}>{e.field}: {e.message}</li>)}</ul>}
      </div>

      <label style={{ fontSize: 12 }}><input type="checkbox" checked={showInactive} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShowInactive(e.target.checked)} /> 無効も表示</label>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
        <thead><tr style={{ borderBottom: "1px solid #ddd", textAlign: "left", color: "#666", fontSize: 12 }}><th style={{ padding: 6 }}>コード</th><th>名称</th><th>備考</th><th>状態</th><th></th></tr></thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.code} style={{ borderBottom: "1px solid #f0f0f0", opacity: it.active ? 1 : 0.5 }}>
              <td style={{ padding: 6 }}><code>{it.code}</code></td>
              {editing === it.code ? (
                <>
                  <td><input value={edit.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEdit({ ...edit, name: e.target.value })} style={{ padding: 4 }} /></td>
                  <td><input value={edit.note} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEdit({ ...edit, note: e.target.value })} style={{ padding: 4 }} /></td>
                  <td colSpan={2}><button onClick={() => void saveEdit(it.code)}>保存</button> <button onClick={() => setEditing(null)}>取消</button></td>
                </>
              ) : (
                <>
                  <td>{it.name}</td>
                  <td style={{ color: "#666" }}>{it.note}</td>
                  <td>{it.active ? "有効" : "無効"}</td>
                  <td style={{ textAlign: "right" }}>
                    <button onClick={() => { setEditing(it.code); setEdit({ name: it.name, note: it.note ?? "" }); }}>編集</button>{" "}
                    <button onClick={() => void toggle(it.code, !it.active)}>{it.active ? "無効化" : "有効化"}</button>
                  </td>
                </>
              )}
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={5} style={{ padding: 16, textAlign: "center", color: "#999" }}>品目がありません。上のフォームから登録してください。</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
