"use client";
/**
 * 基盤ポータルのデモ(モックデータ)。
 *
 * **実物は `apps/platform-portal`**。107 パッケージを検索して「作る前に探す」ための画面。
 * 同じものを二度作らないのが目的。
 */
import * as React from "react";

interface Pkg { name: string; category: string; summary: string; functions: number }

const PACKAGES: Pkg[] = [
  { name: "core", category: "基礎", summary: "エラー型・Result 型。全パッケージの土台", functions: 11 },
  { name: "utils", category: "基礎", summary: "配列・文字列・数値・日付のユーティリティ", functions: 139 },
  { name: "datetime", category: "基礎", summary: "日付・営業日・和暦・タイムゾーン", functions: 52 },
  { name: "auth", category: "認証", summary: "権限判定・OTP・TOTP・WebAuthn", functions: 44 },
  { name: "session", category: "認証", summary: "セッション・Cookie・再認証・自動ログアウト", functions: 16 },
  { name: "accounting", category: "会計", summary: "仕訳・試算表・決算・freee 連携", functions: 25 },
  { name: "tax", category: "会計", summary: "消費税(税率別・内税外税・端数処理)", functions: 12 },
  { name: "invoice", category: "会計", summary: "請求書・入金消込・督促・売掛金年齢表", functions: 23 },
  { name: "ui", category: "UI", summary: "React コンポーネント・フック・チャート", functions: 204 },
  { name: "theme", category: "UI", summary: "11 スキン・WCAG コントラスト検査", functions: 16 },
  { name: "commerce", category: "業務", summary: "カート・在庫引当・注文・ポイント", functions: 57 },
  { name: "booking", category: "業務", summary: "予約・空き枠・営業時間・リマインダー", functions: 33 },
  { name: "task", category: "業務", summary: "タスク・かんばん・工数", functions: 9 },
  { name: "contract", category: "業務", summary: "契約・自動更新・解約予告アラート", functions: 7 },
  { name: "faq", category: "業務", summary: "FAQ・検索・役に立った投票・要見直し検出", functions: 8 },
  { name: "ai", category: "AI", summary: "AI Gateway(モデル差し替え・コスト追跡)", functions: 8 },
  { name: "rag", category: "AI", summary: "文書検索(権限の継承つき)", functions: 10 },
  { name: "observability", category: "運用", summary: "メトリクス・トレース・アラート・Outbox", functions: 19 },
];

export function PortalDemo() {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("すべて");
  const categories = ["すべて", ...Array.from(new Set(PACKAGES.map((p) => p.category)))];

  const shown = PACKAGES.filter((p) => {
    if (category !== "すべて" && p.category !== category) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return p.name.includes(q) || p.summary.toLowerCase().includes(q);
  });

  return (
    <div>
      <div style={banner}>
        これは <strong>デモ</strong> です。実物は <code>apps/platform-portal</code>。
        <strong>作る前に探す</strong>ための画面で、同じものを二度作らないのが目的です。
      </div>

      <div style={{ padding: 16, maxWidth: 900 }}>
        <h2 style={{ fontSize: 18, margin: "0 0 4px" }}>基盤ポータル</h2>
        <p style={{ fontSize: 12, color: "var(--color-muted)", margin: "0 0 12px" }}>
          全 107 パッケージ・1,691 関数(ここでは代表 {PACKAGES.length} 件)。<strong>全関数に TSDoc 完備</strong>。
        </p>

        <input
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          placeholder="やりたいことで探す(例: 消費税、予約、権限)"
          style={{ width: "100%", padding: "8px 12px", fontSize: 13, marginBottom: 8, borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)" }}
        />

        <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
          {categories.map((c) => (
            <button key={c} onClick={() => setCategory(c)}
              style={{ padding: "4px 12px", fontSize: 12, cursor: "pointer", borderRadius: 999, border: "1px solid var(--color-border)",
                background: category === c ? "var(--color-primary)" : "var(--color-surface)",
                color: category === c ? "var(--color-primary-fg, #fff)" : "var(--color-fg)" }}>
              {c}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 }}>
          {shown.map((p) => (
            <div key={p.name} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                <code style={{ fontSize: 13, fontWeight: 700 }}>@platform/{p.name}</code>
                <span style={{ fontSize: 10, color: "var(--color-muted)" }}>{p.functions} 関数</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--color-muted)", lineHeight: 1.6 }}>{p.summary}</div>
            </div>
          ))}
        </div>
        {shown.length === 0 && <p style={{ fontSize: 13, color: "var(--color-muted)" }}>該当なし。別の言い方を試してください。</p>}

        <p style={note}>
          実物では AI からも検索できます(<code>pnpm mcp:catalog</code> で MCP サーバを起動)。
          「CSV を出したい」と聞けば <code>@platform/csv</code> を返します。
        </p>
      </div>
    </div>
  );
}

const banner: React.CSSProperties = { padding: "10px 16px", fontSize: 12, lineHeight: 1.7, background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)", color: "var(--color-muted)" };
const card: React.CSSProperties = { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius, 10px)", padding: 12 };
const note: React.CSSProperties = { fontSize: 11.5, color: "var(--color-muted)", marginTop: 16, lineHeight: 1.7 };
