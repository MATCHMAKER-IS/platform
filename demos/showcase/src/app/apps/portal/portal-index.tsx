"use client";
/** 基盤ポータルの一覧(検索・カテゴリ絞り込み)。データは Server Component から受け取る。 */
import * as React from "react";
import Link from "next/link";
import { Input, Button } from "@platform/ui";

/** 一覧に出す分だけ。関数の詳細は詳細ページで読む。 */
export interface PortalIndexPackage {
  name: string;
  category: string;
  summary: string;
  functions: number;
  types: number;
}

export interface PortalIndexProps {
  packages: PortalIndexPackage[];
  totals: { packages: number; functions: number; types: number };
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
  borderRadius: "var(--radius)",
  padding: 12,
  textDecoration: "none",
  color: "var(--color-fg)",
  display: "block",
};

export function PortalIndex({ packages, totals }: PortalIndexProps) {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("すべて");

  const categories = React.useMemo(
    () => ["すべて", ...Array.from(new Set(packages.map((p) => p.category)))],
    [packages],
  );

  const shown = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return packages.filter((p) => {
      if (category !== "すべて" && p.category !== category) return false;
      if (q === "") return true;
      return p.name.toLowerCase().includes(q) || p.summary.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    });
  }, [packages, query, category]);

  return (
    <>
      <div style={banner}>
        全 <strong>{totals.packages}</strong> パッケージ・<strong>{totals.functions.toLocaleString()}</strong> 関数・
        <strong>{totals.types.toLocaleString()}</strong> 型。<strong>全関数に TSDoc 完備</strong>。
        <br />
        件数も一覧も <code>tools/gen-portal-reference.mjs</code> が実物の TSDoc から生成しています（手で数えていません）。
        <code>packages/</code> は 107 ありますが、<code>@platform/config</code> は
        tsconfig と vitest の共通設定だけでランタイムコードを持たないため、ここには出ません。
      </div>

      <main style={{ maxWidth: 1000, margin: "1.5rem auto", padding: "0 1rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>基盤ポータル</h1>
        <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 16 }}>
          <strong>作る前に探すための画面</strong>です。同じものを二度作らないのが目的。
          パッケージを開くと、<strong>関数の説明・引数・戻り値</strong>が一覧で見られます。
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="やりたいことで探す（例: 消費税、PDF、権限、リトライ）"
            style={{ flex: 1, minWidth: 260 }}
          />
          <span style={{ fontSize: 12, color: "var(--color-muted)" }}>
            {shown.length} / {packages.length} 件
          </span>
        </div>

        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 16 }}>
          {categories.map((c) => (
            <Button key={c} size="sm" variant={category === c ? "primary" : "secondary"} onClick={() => setCategory(c)}>
              {c}
            </Button>
          ))}
        </div>

        {shown.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--color-muted)" }}>該当なし。別の言い方を試してください。</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
            {shown.map((p) => (
              <Link key={p.name} href={`/apps/portal/${p.name}`} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <b style={{ fontSize: 13, fontFamily: "monospace" }}>@platform/{p.name}</b>
                  <span style={{ fontSize: 10, color: "var(--color-muted)", whiteSpace: "nowrap" }}>
                    関数 {p.functions} / 型 {p.types}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--color-muted)", lineHeight: 1.6, marginTop: 4 }}>{p.summary}</div>
                <span
                  style={{
                    display: "inline-block",
                    marginTop: 6,
                    fontSize: 10,
                    padding: "1px 8px",
                    borderRadius: 999,
                    background: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-muted)",
                  }}
                >
                  {p.category}
                </span>
              </Link>
            ))}
          </div>
        )}

        <p style={{ fontSize: 11.5, color: "var(--color-muted)", marginTop: 20, lineHeight: 1.7 }}>
          実物は <code>apps/platform-portal</code>。AI から探す場合は
          <code>pnpm mcp:catalog</code>（MCP サーバ）を Claude Desktop / Claude Code に繋ぐと、
          同じカタログを会話から検索できます。
        </p>
      </main>
    </>
  );
}
