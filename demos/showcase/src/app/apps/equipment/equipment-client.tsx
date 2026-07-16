"use client";
/**
 * 備品管理のデモ(モックデータ)。
 *
 * **実物は `apps/equipment-app`**。ここはモックデータでの再現で、DB を持たない。
 */
import * as React from "react";

interface Item {
  id: string;
  name: string;
  category: string;
  status: "在庫" | "貸出中" | "修理中";
  holder?: string;
  since?: string;
}

const ITEMS: Item[] = [
  { id: "PC-001", name: "ThinkPad X1", category: "PC", status: "貸出中", holder: "田中", since: "2026-06-01" },
  { id: "PC-002", name: "MacBook Pro 14", category: "PC", status: "在庫" },
  { id: "PC-003", name: "ThinkPad T14", category: "PC", status: "貸出中", holder: "鈴木", since: "2026-04-20" },
  { id: "MN-001", name: "27インチ 4K", category: "モニタ", status: "貸出中", holder: "佐藤", since: "2026-05-12" },
  { id: "MN-002", name: "24インチ FHD", category: "モニタ", status: "修理中" },
  { id: "PH-001", name: "iPhone 15", category: "携帯", status: "在庫" },
  { id: "PH-002", name: "Pixel 8", category: "携帯", status: "貸出中", holder: "田中", since: "2026-03-01" },
];

const STATUS_COLOR: Record<Item["status"], string> = {
  在庫: "var(--color-success)",
  貸出中: "var(--color-primary)",
  修理中: "var(--color-warning)",
};

export function EquipmentDemo() {
  const [filter, setFilter] = React.useState("すべて");
  const categories = ["すべて", ...Array.from(new Set(ITEMS.map((i) => i.category)))];
  const shown = filter === "すべて" ? ITEMS : ITEMS.filter((i) => i.category === filter);
  const counts: Record<string, number> = {
    在庫: ITEMS.filter((i) => i.status === "在庫").length,
    貸出中: ITEMS.filter((i) => i.status === "貸出中").length,
    修理中: ITEMS.filter((i) => i.status === "修理中").length,
  };

  return (
    <div>
      <div style={banner}>
        これは <strong>デモ</strong> です。実物は <code>apps/equipment-app</code>。ここは<strong>モックデータ</strong>で、DB を使いません。
      </div>

      <div style={{ padding: 16, maxWidth: 900 }}>
        <h2 style={{ fontSize: 18, margin: "0 0 12px" }}>備品管理</h2>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {Object.entries(counts).map(([k, v]) => (
            <div key={k} style={{ ...card, padding: 10, flex: 1 }}>
              <div style={{ fontSize: 11, color: "var(--color-muted)" }}>{k}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: STATUS_COLOR[k as Item["status"]] }}>{v} 点</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              style={{
                padding: "4px 12px",
                fontSize: 12,
                cursor: "pointer",
                borderRadius: 999,
                border: "1px solid var(--color-border)",
                background: filter === c ? "var(--color-primary)" : "var(--color-surface)",
                color: filter === c ? "var(--color-primary-fg, #fff)" : "var(--color-fg)",
              }}
            >
              {c}
            </button>
          ))}
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ color: "var(--color-muted)", textAlign: "left" }}>
              <th style={th}>管理番号</th>
              <th style={th}>品名</th>
              <th style={th}>分類</th>
              <th style={th}>状態</th>
              <th style={th}>貸出先</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((i) => (
              <tr key={i.id} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ ...td, fontFamily: "var(--font-mono, monospace)" }}>{i.id}</td>
                <td style={td}>{i.name}</td>
                <td style={td}>{i.category}</td>
                <td style={td}>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, color: "#fff", background: STATUS_COLOR[i.status] }}>
                    {i.status}
                  </span>
                </td>
                <td style={td}>{i.holder ? `${i.holder}(${i.since}〜)` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={note}>
          実物では QR コードを貼って現物と紐づけます。棚卸しはスマホのカメラで読み取るだけ
          (<code>@platform/mobile</code> のバーコード検出)。
        </p>
      </div>
    </div>
  );
}

const banner: React.CSSProperties = {
  padding: "10px 16px",
  fontSize: 12,
  lineHeight: 1.7,
  background: "var(--color-surface)",
  borderBottom: "1px solid var(--color-border)",
  color: "var(--color-muted)",
};
const card: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius, 10px)",
};
const th: React.CSSProperties = { padding: "6px 8px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "8px" };
const note: React.CSSProperties = { fontSize: 11.5, color: "var(--color-muted)", marginTop: 12, lineHeight: 1.7 };
