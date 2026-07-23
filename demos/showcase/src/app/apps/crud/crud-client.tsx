"use client";
/**
 * CRUD テンプレートのデモ(モックデータ)。
 *
 * **実物は `apps/crud-template`**。新しいアプリを作るときのコピー元。
 * 一覧・検索・作成・編集・削除という、どのアプリにも要る形を示す。
 */
import * as React from "react";
import { Button, Input } from "@platform/ui";

interface Row { id: string; name: string; email: string; dept: string; createdAt: string }

const SEED: Row[] = [
  { id: "1", name: "田中 太郎", email: "tanaka@example.jp", dept: "情シス", createdAt: "2026-04-01" },
  { id: "2", name: "佐藤 花子", email: "sato@example.jp", dept: "経理", createdAt: "2026-04-15" },
  { id: "3", name: "鈴木 一郎", email: "suzuki@example.jp", dept: "総務", createdAt: "2026-05-02" },
  { id: "4", name: "高橋 二郎", email: "takahashi@example.jp", dept: "情シス", createdAt: "2026-05-20" },
  { id: "5", name: "伊藤 三郎", email: "ito@example.jp", dept: "営業", createdAt: "2026-06-10" },
];

export function CrudDemo() {
  const [rows, setRows] = React.useState<Row[]>(SEED);
  const [search, setSearch] = React.useState("");
  const [editing, setEditing] = React.useState<Row | null>(null);

  const filtered = rows.filter((r) => !search || r.name.includes(search) || r.email.includes(search) || r.dept.includes(search));

  const remove = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));
  const save = (row: Row) => {
    setRows((prev) => (prev.some((r) => r.id === row.id) ? prev.map((r) => (r.id === row.id ? row : r)) : [...prev, row]));
    setEditing(null);
  };

  return (
    <div>
      <div style={banner}>
        これは <strong>デモ</strong> です。実物は <code>apps/crud-template</code>。
        <strong>新しいアプリを作るときのコピー元</strong>で、一覧・検索・作成・編集・削除の形を示します。
      </div>

      <div style={{ padding: 16, maxWidth: 900 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <Input
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            placeholder="名前・メール・部署で検索"
            style={{ flex: 1, padding: "8px 12px", fontSize: 13, borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)" }}
          />
          <Button
            onClick={() => setEditing({ id: String(Date.now()), name: "", email: "", dept: "", createdAt: new Date().toISOString().slice(0, 10) })}
            style={{ padding: "8px 16px", fontSize: 13, cursor: "pointer", borderRadius: 8, border: "none", background: "var(--color-primary)", color: "var(--color-primary-fg, #fff)" }}
          >
            + 新規
          </Button>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ color: "var(--color-muted)", textAlign: "left" }}>
              <th style={th}>名前</th><th style={th}>メール</th><th style={th}>部署</th><th style={th}>登録日</th><th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={td}>{r.name}</td>
                <td style={td}>{r.email}</td>
                <td style={td}>{r.dept}</td>
                <td style={td}>{r.createdAt}</td>
                <td style={{ ...td, textAlign: "right" }}>
                  <Button onClick={() => setEditing(r)} style={btn}>編集</Button>
                  <Button onClick={() => remove(r.id)} style={{ ...btn, color: "var(--color-danger)" }}>削除</Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "var(--color-muted)" }}>該当なし</td></tr>
            )}
          </tbody>
        </table>

        {editing && <EditForm row={editing} onSave={save} onCancel={() => setEditing(null)} />}

        <p style={note}>
          実物は Prisma で DB に保存します(<code>@platform/db</code>)。テナント条件は自動で付くので、
          <strong>他社のデータが見える事故</strong>が起きません。
        </p>
      </div>
    </div>
  );
}

function EditForm({ row, onSave, onCancel }: { row: Row; onSave: (r: Row) => void; onCancel: () => void }) {
  const [form, setForm] = React.useState(row);
  const valid = form.name.trim() !== "" && form.email.includes("@");

  return (
    <div style={{ ...card, marginTop: 12, borderLeft: "4px solid var(--color-primary)" }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{row.name ? "編集" : "新規作成"}</div>
      {(["name", "email", "dept"] as const).map((k) => (
        <div key={k} style={{ marginBottom: 8 }}>
          <label style={{ display: "block", fontSize: 11, color: "var(--color-muted)", marginBottom: 2 }}>
            {k === "name" ? "名前" : k === "email" ? "メール" : "部署"}
          </label>
          <Input
            value={form[k]}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })}
            style={{ width: "100%", padding: "6px 10px", fontSize: 13, borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)" }}
          />
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <Button onClick={() => onSave(form)} disabled={!valid}
          style={{ padding: "6px 16px", fontSize: 12, cursor: valid ? "pointer" : "not-allowed", borderRadius: 6, border: "none",
            background: valid ? "var(--color-primary)" : "var(--color-muted)", color: "#fff", opacity: valid ? 1 : 0.5 }}>
          保存
        </Button>
        <Button onClick={onCancel} style={{ ...btn, padding: "6px 16px" }}>キャンセル</Button>
      </div>
      {!valid && <p style={{ fontSize: 11, color: "var(--color-muted)", margin: "8px 0 0" }}>名前とメール(@ を含む)は必須です</p>}
    </div>
  );
}

const banner: React.CSSProperties = { padding: "10px 16px", fontSize: 12, lineHeight: 1.7, background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)", color: "var(--color-muted)" };
const card: React.CSSProperties = { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius, 10px)", padding: 14 };
const th: React.CSSProperties = { padding: "6px 8px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "8px" };
const btn: React.CSSProperties = { padding: "2px 10px", fontSize: 11, marginLeft: 4, cursor: "pointer", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-fg)" };
const note: React.CSSProperties = { fontSize: 11.5, color: "var(--color-muted)", marginTop: 16, lineHeight: 1.7 };
