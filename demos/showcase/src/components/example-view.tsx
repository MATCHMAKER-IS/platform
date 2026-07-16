"use client";
/**
 * 使用例ビューア。
 *
 * **画面を持たないデモ**(純ロジック)を、コードと実行結果で見せる。
 *
 * なぜコードを見せるか: 基盤の関数は「どう組み合わせるか」が肝で、
 * API リファレンスを 1 つずつ読んでも分からない。**動く例を 1 本見せる**方が早い。
 */
import * as React from "react";

/** 使用例 1 件。 */
export interface ExampleViewProps {
  /** 見出し。 */
  title: string;
  /** 何を示す例か(なぜこれが要るか)。 */
  intro: string;
  /** 使っている基盤パッケージ。 */
  packages: string[];
  /** ソースコード(実際のデモから読み込んだもの)。 */
  code: string;
  /** 実行結果(あれば)。 */
  output?: React.ReactNode;
  /** 補足(落とし穴・設計の理由)。 */
  notes?: string[];
}

export function ExampleView({ title, intro, packages, code, output, notes }: ExampleViewProps) {
  const [tab, setTab] = React.useState<"code" | "output">(output ? "output" : "code");

  return (
    <div style={{ padding: 16, maxWidth: 900 }}>
      <h2 style={{ fontSize: 18, margin: "0 0 6px" }}>{title}</h2>
      <p style={{ fontSize: 13, color: "var(--color-muted)", margin: "0 0 10px", lineHeight: 1.8 }}>{intro}</p>

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 16 }}>
        {packages.map((p) => (
          <code
            key={p}
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 999,
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-muted)",
            }}
          >
            @platform/{p}
          </code>
        ))}
      </div>

      {output && (
        <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--color-border)", marginBottom: 12 }}>
          {([
            ["output", "実行結果"],
            ["code", "コード"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              style={{
                padding: "8px 14px",
                border: "none",
                background: "none",
                cursor: "pointer",
                fontSize: 13,
                borderBottom: tab === k ? "2px solid var(--color-primary)" : "2px solid transparent",
                color: tab === k ? "var(--color-primary)" : "var(--color-muted)",
                fontWeight: tab === k ? 700 : 400,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === "output" && output && <div style={{ marginBottom: 16 }}>{output}</div>}

      {tab === "code" && (
        <pre
          style={{
            margin: 0,
            padding: 14,
            borderRadius: "var(--radius, 10px)",
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            overflowX: "auto",
            fontSize: 11.5,
            lineHeight: 1.7,
            fontFamily: "var(--font-mono, ui-monospace, monospace)",
          }}
        >
          <code>{code}</code>
        </pre>
      )}

      {notes && notes.length > 0 && (
        <div style={{ marginTop: 16, padding: 12, borderRadius: "var(--radius, 10px)", background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>設計の理由 / 落とし穴</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.9, color: "var(--color-muted)" }}>
            {notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** 実行結果を素朴に見せる(JSON 整形)。 */
export function OutputJson({ value }: { value: unknown }) {
  return (
    <pre
      style={{
        margin: 0,
        padding: 14,
        borderRadius: "var(--radius, 10px)",
        border: "1px solid var(--color-border)",
        background: "var(--color-bg)",
        overflowX: "auto",
        fontSize: 11.5,
        lineHeight: 1.7,
        fontFamily: "var(--font-mono, ui-monospace, monospace)",
      }}
    >
      <code>{JSON.stringify(value, null, 2)}</code>
    </pre>
  );
}

/** 実行結果をテキストで見せる(整形済みの出力向け)。 */
export function OutputText({ text }: { text: string }) {
  return (
    <pre
      style={{
        margin: 0,
        padding: 14,
        borderRadius: "var(--radius, 10px)",
        border: "1px solid var(--color-border)",
        background: "var(--color-bg)",
        overflowX: "auto",
        fontSize: 12.5,
        lineHeight: 1.9,
        fontFamily: "var(--font-mono, ui-monospace, monospace)",
        whiteSpace: "pre-wrap",
      }}
    >
      {text}
    </pre>
  );
}
