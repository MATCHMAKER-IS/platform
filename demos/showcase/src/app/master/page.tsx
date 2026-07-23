"use client";
/**
 * マスタ管理のデモ（取引先・商品・部門の汎用 CRUD）。
 * 項目定義（フィールドスキーマ）でマスタを切り替え、一覧・検索・登録・編集・削除。
 * 各マスタは localStorage に個別保存（リロード復元）。
 */
import * as React from "react";
import { Badge, Button, Checkbox, Input } from "@platform/ui";

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };
type FieldType = "text" | "number" | "select" | "bool" | "ref" | "date";
type Field = { key: string; label: string; type: FieldType; options?: string[]; required?: boolean; refMaster?: string };
type Row = Record<string, string | number | boolean> & { id: string };
type Master = { id: string; label: string; storageKey: string; fields: Field[]; seed: Row[] };

const MASTERS: Master[] = [
  { id: "partner", label: "取引先", storageKey: "demo-master-partner",
    fields: [
      { key: "code", label: "コード", type: "text", required: true },
      { key: "name", label: "名称", type: "text", required: true },
      { key: "category", label: "分類", type: "select", options: ["仕入先", "得意先", "外注先"] },
      { key: "contact", label: "連絡先", type: "text" },
      { key: "since", label: "取引開始日", type: "date" },
      { key: "active", label: "有効", type: "bool" },
    ],
    seed: [
      { id: "p1", code: "P-001", name: "山田商事", category: "仕入先", contact: "yamada@example.co.jp", since: "2021-04-01", active: true },
      { id: "p2", code: "P-002", name: "東京システム", category: "外注先", contact: "tokyo@example.co.jp", since: "2022-10-15", active: true },
      { id: "p3", code: "P-003", name: "さくら物産", category: "得意先", contact: "sakura@example.co.jp", since: "2020-01-20", active: false },
    ] },
  { id: "product", label: "商品", storageKey: "demo-master-product",
    fields: [
      { key: "code", label: "商品コード", type: "text", required: true },
      { key: "name", label: "商品名", type: "text", required: true },
      { key: "category", label: "カテゴリ", type: "select", options: ["文具", "食品", "家電"] },
      { key: "price", label: "単価", type: "number" },
      { key: "active", label: "販売中", type: "bool" },
    ],
    seed: [
      { id: "g1", code: "SKU-100", name: "A4ノート", category: "文具", price: 220, active: true },
      { id: "g2", code: "SKU-200", name: "ドリップコーヒー", category: "食品", price: 980, active: true },
      { id: "g3", code: "SKU-300", name: "USB充電器", category: "家電", price: 1480, active: false },
    ] },
  { id: "dept", label: "部門", storageKey: "demo-master-dept",
    fields: [
      { key: "code", label: "部門コード", type: "text", required: true },
      { key: "name", label: "部門名", type: "text", required: true },
      { key: "manager", label: "責任者", type: "text" },
      { key: "active", label: "有効", type: "bool" },
    ],
    seed: [
      { id: "d1", code: "D-10", name: "営業部", manager: "田中", active: true },
      { id: "d2", code: "D-20", name: "開発部", manager: "鈴木", active: true },
    ] },
  { id: "order", label: "受注", storageKey: "demo-master-order",
    fields: [
      { key: "code", label: "受注番号", type: "text", required: true },
      { key: "partner", label: "取引先", type: "ref", refMaster: "partner", required: true },
      { key: "product", label: "商品", type: "ref", refMaster: "product", required: true },
      { key: "qty", label: "数量", type: "number" },
      { key: "status", label: "状態", type: "select", options: ["受付", "手配中", "出荷済"] },
    ],
    seed: [
      { id: "o1", code: "SO-001", partner: "p1", product: "g1", qty: 100, status: "受付" },
      { id: "o2", code: "SO-002", partner: "p3", product: "g2", qty: 20, status: "出荷済" },
    ] },
];

/** 参照先マスタの現在行を取得（localStorage 優先・無ければ seed）。 */
function refRows(masterId?: string): Row[] {
  const m = MASTERS.find((x) => x.id === masterId);
  if (!m) return [];
  try { const r = localStorage.getItem(m.storageKey); return r ? JSON.parse(r) : m.seed; } catch { return m.seed; }
}

/** このマスタを参照している (他マスタ, フィールド) の一覧。 */
function refsToMaster(masterId: string): { master: Master; field: Field }[] {
  const out: { master: Master; field: Field }[] = [];
  for (const m of MASTERS) for (const f of m.fields) if (f.type === "ref" && f.refMaster === masterId) out.push({ master: m, field: f });
  return out;
}
/** 特定行を参照している行（逆引き）。 */
function referencingRows(masterId: string, rowId: string): { master: Master; row: Row }[] {
  const out: { master: Master; row: Row }[] = [];
  for (const { master, field } of refsToMaster(masterId)) for (const row of refRows(master.id)) if (String(row[field.key]) === String(rowId)) out.push({ master, row });
  return out;
}

const blankRow = (m: Master): Row => {
  const r: Row = { id: "r_" + Math.random().toString(36).slice(2, 8) };
  for (const f of m.fields) r[f.key] = f.type === "bool" ? true : f.type === "number" ? 0 : f.type === "select" ? (f.options?.[0] ?? "") : "";
  return r;
};
const validRow = (m: Master, r: Row) => m.fields.filter((f) => f.required).every((f) => String(r[f.key] ?? "").trim() !== "");

export default function Page() {
  const [mid, setMid] = React.useState(MASTERS[0]!.id);
  const master = MASTERS.find((m) => m.id === mid)!;
  const [rows, setRows] = React.useState<Row[]>(master.seed);
  const [q, setQ] = React.useState("");
  const [editing, setEditing] = React.useState<Row | null>(null);
  const [isNew, setIsNew] = React.useState(false);
  const [confirmDel, setConfirmDel] = React.useState<Row | null>(null);
  const [related, setRelated] = React.useState<Row | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [history, setHistory] = React.useState<{ at: string; text: string }[]>([]);
  const [showHistory, setShowHistory] = React.useState(false);
  React.useEffect(() => { try { const r = localStorage.getItem("demo-master-history"); if (r) setHistory(JSON.parse(r)); } catch { /* noop */ } }, []);
  React.useEffect(() => { try { localStorage.setItem("demo-master-history", JSON.stringify(history)); } catch { /* noop */ } }, [history]);
  const log = (text: string) => setHistory((h) => [{ at: new Date().toISOString(), text }, ...h].slice(0, 50));
  const [reassignTo, setReassignTo] = React.useState("");
  const [selectedRefs, setSelectedRefs] = React.useState<Set<string>>(new Set());
  // 逆引きパネルを開いたら参照元をすべて選択状態にする
  React.useEffect(() => {
    if (related) setSelectedRefs(new Set(referencingRows(master.id, String(related.id)).map(({ master: m, row }) => `${m.id}:${row.id}`)));
  }, [related, mid]);

  // マスタ切替時に該当データを読み込み
  React.useEffect(() => {
    try { const r = localStorage.getItem(master.storageKey); setRows(r ? JSON.parse(r) : master.seed); }
    catch { setRows(master.seed); }
    setQ("");
  }, [mid]);

  const persist = (next: Row[]) => { setRows(next); try { localStorage.setItem(master.storageKey, JSON.stringify(next)); } catch { /* noop */ } };
  const filtered = rows.filter((r) => master.fields.map((f) => String(r[f.key])).join(" ").toLowerCase().includes(q.toLowerCase()));
  const isReferenced = refsToMaster(master.id).length > 0;
  const delRefs = confirmDel ? referencingRows(master.id, String(confirmDel.id)) : [];
  const save = () => {
    if (!editing || !validRow(master, editing)) return;
    persist(isNew ? [...rows, editing] : rows.map((r) => (r.id === editing.id ? editing : r)));
    log(`${master.label}マスタ：${isNew ? "登録" : "編集"}「${String(editing.name ?? editing.code)}」`);
    setEditing(null);
  };

  // CSV 入出力
  const csvCell = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const parseLine = (line: string) => {
    const out: string[] = [];
    let cur = "", q = false;
    for (let i = 0; i < line.length; i++) { const c = line[i]; if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; } else { if (c === '"') q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c; } } out.push(cur);
    return out;
  };
  const exportCsv = () => {
    const header = master.fields.map((f) => f.label).join(",");
    const body = rows.map((r) => master.fields.map((f) => csvCell(r[f.key])).join(","));
    const csv = "\uFEFF" + [header, ...body].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `${master.id}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const importCsv = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result).replace(/^\uFEFF/, "");
      const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
      if (lines.length < 1) return;
      const headers = parseLine(lines[0]!);
      const next: Row[] = lines.slice(1).map((line) => {
        const cells = parseLine(line);
        const row: Row = { id: "r_" + Math.random().toString(36).slice(2, 8) };
        for (const f of master.fields) {
          const idx = headers.indexOf(f.label);
          const v = idx >= 0 ? (cells[idx] ?? "") : "";
          row[f.key] = f.type === "number" ? (Number(v) || 0) : f.type === "bool" ? ["true", "有効", "販売中", "1"].includes(v) : v;
        }
        return row;
      });
      persist(next); log(`${master.label}マスタ：CSV取込 ${next.length}件`);
    };
    reader.readAsText(file);
  };

  // 逆引きからの一括更新：選択した参照元の参照先を reassignTo に付け替える
  const reassignAll = () => {
    if (!related || !reassignTo) return;
    for (const { master: m, field } of refsToMaster(master.id)) {
      const mrows = refRows(m.id).map((row) => (selectedRefs.has(`${m.id}:${row.id}`) && String(row[field.key]) === String(related.id) ? { ...row, [field.key]: reassignTo } : row));
      try { localStorage.setItem(m.storageKey, JSON.stringify(mrows)); } catch { /* noop */ }
      if (m.id === mid) setRows(mrows);
    }
    log(`${master.label}マスタ：一括付け替え ${selectedRefs.size}件`);
    setRelated(null); setReassignTo("");
  };

  const cell = (r: Row, f: Field) => f.type === "bool" ? (r[f.key] ? <Badge variant="success">{f.label.includes("販売") ? "販売中" : "有効"}</Badge> : <Badge variant="secondary">停止</Badge>)
    : f.type === "ref" ? String(refRows(f.refMaster).find((x) => String(x.id) === String(r[f.key]))?.name ?? "—")
    : f.type === "number" ? Number(r[f.key] ?? 0).toLocaleString() : String(r[f.key] ?? "");

  return (
    <main style={{ maxWidth: 920, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 6 }}>マスタ管理（CRUD）</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 14 }}>マスタを切り替えて、一覧・検索・登録・編集・削除。各マスタは localStorage に個別保存されます。</p>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {MASTERS.map((m) => (
          <Button key={m.id} type="button" onClick={() => setMid(m.id)}
            style={{ fontSize: 13, padding: "6px 16px", borderRadius: 999, cursor: "pointer", border: "1px solid var(--color-border)", background: mid === m.id ? "var(--color-primary)" : "var(--color-bg)", color: mid === m.id ? "var(--color-primary-fg)" : "var(--color-fg)" }}>
            {m.label}マスタ</Button>))}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="検索" /></div>
        <Button onClick={() => { setEditing(blankRow(master)); setIsNew(true); }}>＋ 新規登録</Button>
        <Button variant="secondary" onClick={exportCsv}>CSV出力</Button>
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>CSV取込</Button>
        <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ""; }} />
        <Button variant="secondary" onClick={() => persist(master.seed)}>初期化</Button>
        <Button variant="secondary" onClick={() => setShowHistory(true)}>履歴{history.length ? `(${history.length})` : ""}</Button>
      </div>

      <div style={{ ...box, padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ textAlign: "left", color: "var(--color-muted)", background: "var(--color-bg)" }}>
            {master.fields.map((f) => <th key={f.key} style={th}>{f.label}</th>)}{isReferenced && <th style={th}>被参照</th>}<th style={th}></th></tr></thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--color-border)" }}>
                {master.fields.map((f) => <td key={f.key} style={{ ...td, ...(f.key === "code" ? { fontFamily: "monospace" } : {}) }}>{cell(r, f)}</td>)}
                {isReferenced && (
                  <td style={td}>{referencingRows(master.id, String(r.id)).length > 0
                    ? <Button type="button" onClick={() => setRelated(r)} style={{ ...linkBtn, marginRight: 0 }}><Badge variant="secondary">{referencingRows(master.id, String(r.id)).length} 件</Badge></Button>
                    : <span style={{ color: "var(--color-muted)" }}>—</span>}</td>
                )}
                <td style={{ ...td, whiteSpace: "nowrap" }}>
                  <Button type="button" onClick={() => { setEditing({ ...r }); setIsNew(false); }} style={linkBtn}>編集</Button>
                  <Button type="button" onClick={() => setConfirmDel(r)} style={{ ...linkBtn, color: "var(--color-danger)" }}>削除</Button>
                </td>
              </tr>))}
            {filtered.length === 0 && <tr><td colSpan={master.fields.length + (isReferenced ? 2 : 1)} style={{ ...td, textAlign: "center", color: "var(--color-muted)" }}>該当なし</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 12, color: "var(--color-muted)" }}>{filtered.length} 件 / 全 {rows.length} 件</div>

      {editing && (
        <div role="presentation" style={overlay} onClick={() => setEditing(null)}>
          <div role="dialog" aria-modal="true" style={modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>{master.label}マスタ・{isNew ? "新規登録" : "編集"}</div>
            <div style={{ display: "grid", gap: 10 }}>
              {master.fields.map((f) => (
                <label key={f.key} style={f.type === "bool" ? { display: "flex", alignItems: "center", gap: 6, fontSize: 13 } : lbl}>
                  {f.type === "bool" ? (<><Checkbox  checked={!!editing[f.key]} onCheckedChange={(v) => setEditing({ ...editing, [f.key]: !!v })} />{f.label}</>)
                    : (<>{f.label}{f.required && " *"}
                      {f.type === "ref" ? (
                        <select value={String(editing[f.key] ?? "")} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} style={sel}>
                          <option value="">（未選択）</option>
                          {refRows(f.refMaster).map((x) => <option key={String(x.id)} value={String(x.id)}>{String(x.name ?? x.code ?? x.id)}</option>)}
                        </select>
                      ) : f.type === "date" ? (
                        <Input type="date" value={String(editing[f.key] ?? "")} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} style={sel} />
                      ) : f.type === "select" ? (
                        <select value={String(editing[f.key])} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} style={sel}>
                          {f.options!.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                      ) : (
                        <Input value={String(editing[f.key] ?? "")} onChange={(e) => setEditing({ ...editing, [f.key]: f.type === "number" ? (Number(e.target.value) || 0) : e.target.value })} />
                      )}</>)}
                </label>))}
            </div>
            {!validRow(master, editing) && <div style={{ fontSize: 11, color: "var(--color-danger)", marginTop: 8 }}>必須項目（*）を入力してください</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <Button variant="secondary" onClick={() => setEditing(null)}>キャンセル</Button>
              <Button onClick={save} disabled={!validRow(master, editing)}>保存</Button>
            </div>
          </div>
        </div>
      )}

      {confirmDel && (
        <div role="presentation" style={overlay} onClick={() => setConfirmDel(null)}>
          <div role="dialog" aria-modal="true" style={{ ...modal, maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>削除の確認</div>
            <div style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16 }}><strong>{String(confirmDel.name ?? confirmDel.code ?? "")}</strong> を削除します。よろしいですか？</div>
            {delRefs.length > 0 && (
              <div style={{ fontSize: 12, color: "var(--color-danger)", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: 10, marginBottom: 16 }}>
                この行は {delRefs.length} 件から参照されているため削除できません（{delRefs.map((x) => String(x.row.code)).join(", ")}）。先に参照側を変更してください。
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button variant="secondary" onClick={() => setConfirmDel(null)}>キャンセル</Button>
              <Button onClick={() => { persist(rows.filter((r) => r.id !== confirmDel.id)); log(`${master.label}マスタ：削除「${String(confirmDel.name ?? confirmDel.code)}」`); setConfirmDel(null); }} disabled={delRefs.length > 0}>削除する</Button>
            </div>
          </div>
        </div>
      )}

      {related && (
        <div role="presentation" style={overlay} onClick={() => setRelated(null)}>
          <div role="dialog" aria-modal="true" style={modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>参照元（逆引き）</div>
            <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 12 }}><strong>{String(related.name ?? related.code)}</strong> を参照している行</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 6 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                <Checkbox 
                  checked={referencingRows(master.id, String(related.id)).length > 0 && selectedRefs.size === referencingRows(master.id, String(related.id)).length} onCheckedChange={(v) => setSelectedRefs(!!v ? new Set(referencingRows(master.id, String(related.id)).map(({ master: m, row }) => `${m.id}:${row.id}`)) : new Set())} />
                すべて選択
              </label>
              <span style={{ color: "var(--color-muted)", marginLeft: "auto" }}>{selectedRefs.size} 件選択</span>
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto" }}>
              {referencingRows(master.id, String(related.id)).map(({ master: m, row }) => {
                const key = `${m.id}:${row.id}`;
                return (
                  <li key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "8px 10px", borderRadius: 6, background: "var(--color-bg)", border: "1px solid var(--color-border)" }}>
                    <Checkbox  checked={selectedRefs.has(key)} onCheckedChange={(v) => setSelectedRefs((prev) => { const n = new Set(prev); if (!!v) n.add(key); else n.delete(key); return n; })} />
                    <Badge variant="secondary">{m.label}</Badge>
                    <span style={{ fontFamily: "monospace" }}>{String(row.code)}</span>
                    <Button type="button" onClick={() => { setRelated(null); setMid(m.id); }} style={{ ...linkBtn, marginLeft: "auto", marginRight: 0 }}>開く</Button>
                  </li>
                );
              })}
            </ul>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--color-border)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>一括付け替え</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "var(--color-muted)" }}>参照先を</span>
                <select value={reassignTo} onChange={(e) => setReassignTo(e.target.value)} style={sel}>
                  <option value="">（選択）</option>
                  {rows.filter((r) => r.id !== related.id).map((r) => <option key={String(r.id)} value={String(r.id)}>{String(r.name ?? r.code)}</option>)}
                </select>
                <span style={{ fontSize: 12, color: "var(--color-muted)" }}>にまとめて変更</span>
                <Button size="sm" onClick={reassignAll} disabled={!reassignTo || selectedRefs.size === 0}>選択を付け替え</Button>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <Button variant="secondary" onClick={() => setRelated(null)}>閉じる</Button>
            </div>
          </div>
        </div>
      )}

      {showHistory && (
        <div role="presentation" style={overlay} onClick={() => setShowHistory(false)}>
          <div role="dialog" aria-modal="true" style={modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>変更履歴</div>
              {history.length > 0 && <Button type="button" onClick={() => setHistory([])} style={{ ...linkBtn, marginLeft: "auto", marginRight: 0, color: "var(--color-danger)" }}>クリア</Button>}
            </div>
            {history.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--color-muted)", padding: "12px 0" }}>まだ変更はありません。登録・編集・削除・CSV取込・一括付け替えが記録されます。</div>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
                {history.map((h, i) => (
                  <li key={i} style={{ fontSize: 12.5, padding: "8px 10px", borderRadius: 6, background: "var(--color-bg)", border: "1px solid var(--color-border)" }}>
                    <span style={{ color: "var(--color-muted)", fontFamily: "monospace", marginRight: 8 }}>{new Date(h.at).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                    {h.text}
                  </li>
                ))}
              </ul>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <Button variant="secondary" onClick={() => setShowHistory(false)}>閉じる</Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
const th: React.CSSProperties = { padding: "10px 12px", fontWeight: 600, whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "10px 12px" };
const linkBtn: React.CSSProperties = { background: "none", border: "none", cursor: "pointer", color: "var(--color-primary)", fontSize: 13, marginRight: 10, padding: 0 };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 };
const modal: React.CSSProperties = { background: "var(--color-surface)", borderRadius: "var(--radius)", border: "1px solid var(--color-border)", padding: 20, width: "100%", maxWidth: 440, boxShadow: "0 10px 40px rgba(0,0,0,0.3)" };
const lbl: React.CSSProperties = { display: "grid", gap: 4, fontSize: 12, color: "var(--color-muted)" };
const sel: React.CSSProperties = { padding: "8px 10px", borderRadius: "var(--radius)", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)" };
