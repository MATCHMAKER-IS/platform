"use client";
/**
 * この画面が使っている基盤と、最短の書き方を示す。
 *
 * デモは「動くこと」は見せられるが、**どう書くか**が分からないと
 * 自分のアプリに持ち帰れない。実際、64 デモのうち 47 が
 * コード例を持っておらず、「動いたけど書き方が分からない」状態だった。
 *
 * 画面の下に 1 つ置くだけで、
 *   - 使っている基盤（押すと目録へ）
 *   - 取り込み方（そのままコピーできる）
 *   - 詳しい説明の場所
 * が揃うようにする。
 */
import * as React from "react";
import { Button } from "@platform/ui";

/** {@link UsesPackages} の props。 */
export interface UsesPackagesProps {
  /** 使っている基盤（`@platform/` は省く）。 */
  packages: string[];
  /** 取り込む名前（省略すると import 文は出さない）。 */
  imports?: Record<string, string[]>;
  /** 最短の使い方（数行で十分）。 */
  snippet?: string;
  /** 関連する資料へのリンク。 */
  docs?: { label: string; href: string }[];
}

/** 基盤の名前空間。文字列として組み立てるために変数にしている。 */
const NS = "@platform";

const mono: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  lineHeight: 1.8,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

/**
 * 画面の下に置く「持ち帰り方」の案内。
 *
 * @example
 * ```tsx
 * <UsesPackages
 *   packages={["csv", "ui"]}
 *   imports={{ csv: ["toCsv", "downloadCsv"] }}
 *   snippet={`const csv = toCsv(rows, { columns });\ndownloadCsv("一覧.csv", rows);`}
 * />
 * ```
 */
export function UsesPackages({ packages, imports, snippet, docs }: UsesPackagesProps) {
  const [copied, setCopied] = React.useState(false);

  const importLines = imports
    ? Object.entries(imports)
        // 名前空間を変数にしておく。文字列に "from \"@platform/" と直接書くと、
        // 依存の検査(check-showcase-deps)が**実際の import と誤認**する
        .map(([pkg, names]) => `import { ${names.join(", ")} } from "${NS}/${pkg}";`)
        .join("\n")
    : "";
  const code = [importLines, snippet].filter(Boolean).join("\n\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* 使えない環境でも画面は壊さない */
    }
  };

  return (
    <section
      style={{
        marginTop: 28,
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius)",
        background: "var(--color-surface)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "8px 14px",
          borderBottom: "1px solid var(--color-border)",
          fontSize: 12.5,
          fontWeight: 700,
        }}
      >
        自分のアプリで使うには
      </div>

      <div style={{ padding: 14 }}>
        <div style={{ fontSize: 11.5, color: "var(--color-muted)", marginBottom: 6 }}>
          この画面が使っている基盤
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {packages.map((p) => (
            <a
              key={p}
              href={`/apps/portal?q=${encodeURIComponent(p)}`}
              style={{
                fontSize: 11.5,
                fontFamily: "var(--font-mono)",
                padding: "3px 9px",
                borderRadius: 999,
                border: "1px solid var(--color-border)",
                color: "var(--color-primary)",
                textDecoration: "none",
              }}
            >
              @platform/{p}
            </a>
          ))}
        </div>

        {code !== "" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 11.5, color: "var(--color-muted)" }}>最短の書き方</span>
              <Button size="sm" variant="secondary" onClick={() => void copy()}>
                {copied ? "コピーしました" : "コピー"}
              </Button>
            </div>
            <pre
              style={{
                ...mono,
                margin: 0,
                padding: 12,
                borderRadius: 6,
                background: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                overflowX: "auto",
              }}
            >
              {code}
            </pre>
          </>
        )}

        <p style={{ fontSize: 11.5, color: "var(--color-muted)", lineHeight: 1.9, margin: "12px 0 0" }}>
          詳しい使い方は <code>packages/&lt;名前&gt;/README.md</code> にあります。
          <strong>⌘K（Ctrl+K）で「{packages[0]}」と打つ</strong>と、関連する資料も探せます。
          {docs && docs.length > 0 && (
            <>
              <br />
              関連: {docs.map((d, i) => (
                <React.Fragment key={d.href}>
                  {i > 0 ? " / " : ""}
                  <a href={d.href} style={{ color: "var(--color-primary)" }}>{d.label}</a>
                </React.Fragment>
              ))}
            </>
          )}
        </p>
      </div>
    </section>
  );
}
