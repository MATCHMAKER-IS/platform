"use client";
/**
 * @platform/core の「作法」ページ。
 * Result（成功/失敗）と AppError（構造化エラー）の使い方を、実際に import して動かして示す。
 * この土台は全パッケージ・全デモの下敷きになっている。
 */
import * as React from "react";
import { Badge, Alert, Input, Separator } from "@platform/ui";
import { ok, err, AppError, ErrorCode, type Result } from "@platform/core";

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };
const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" };

// 例1: 例外を投げず Result で返す
function parsePositiveInt(input: string): Result<number> {
  const n = Number(input);
  if (input.trim() === "" || !Number.isInteger(n)) return err(new AppError(ErrorCode.VALIDATION, "整数を入力してください", { details: { input } }));
  if (n <= 0) return err(new AppError(ErrorCode.VALIDATION, "正の数にしてください", { details: { input } }));
  return ok(n);
}

// 例2: 既存の例外を AppError に包む
function riskyDivide(a: number, b: number): Result<number> {
  try {
    if (b === 0) throw new Error("division by zero");
    return ok(a / b);
  } catch (e) {
    return err(AppError.from(e, ErrorCode.INTERNAL));
  }
}

const CODES: { code: string; when: string; http: number }[] = [
  { code: "VALIDATION", when: "入力が不正", http: 400 },
  { code: "UNAUTHORIZED", when: "未認証（ログインが必要）", http: 401 },
  { code: "FORBIDDEN", when: "権限不足", http: 403 },
  { code: "NOT_FOUND", when: "対象が存在しない", http: 404 },
  { code: "CONFLICT", when: "競合（重複・状態不整合）", http: 409 },
  { code: "RATE_LIMITED", when: "回数制限超過", http: 429 },
  { code: "EXTERNAL", when: "外部サービス起因", http: 502 },
  { code: "DATABASE", when: "DB 起因", http: 500 },
  { code: "CONFIG", when: "設定不備", http: 500 },
  { code: "INTERNAL", when: "その他内部エラー", http: 500 },
];

function ResultView({ r }: { r: Result<number> }) {
  return r.ok ? (
    <div style={{ ...mono, color: "var(--color-success, #16a34a)" }}>ok → value: {r.value}</div>
  ) : (
    <div style={{ ...mono, color: "var(--color-danger)" }}>err → [{r.error.code}] {r.error.message}
      {r.error.details && <span style={{ color: "var(--color-muted)" }}> · details: {JSON.stringify(r.error.details)}</span>}</div>
  );
}

export default function Page() {
  const [input, setInput] = React.useState("42");
  const parsed = parsePositiveInt(input);
  const [divA, setDivA] = React.useState("10");
  const [divB, setDivB] = React.useState("0");
  const divided = riskyDivide(Number(divA) || 0, Number(divB) || 0);

  return (
    <main style={{ maxWidth: 820, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 6 }}>core の作法（Result / AppError）</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16, lineHeight: 1.8 }}>
        全パッケージ・全デモの土台です。<strong>「起こりうる失敗は例外で投げず、Result で返す」</strong>のが基本。
        このページは実際に <code>@platform/core</code> を import して動かしています。
      </p>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>① Result で安全に返す</div>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 10 }}>成功は <code style={mono}>ok(value)</code>、失敗は <code style={mono}>err(AppError)</code>。呼ぶ側は <code style={mono}>if (!res.ok)</code> で分岐します。</p>
        <Input value={input} onChange={(e) => setInput(e.target.value)} />
        <div style={{ marginTop: 10, padding: 10, background: "var(--color-bg)", borderRadius: "var(--radius)", border: "1px solid var(--color-border)" }}>
          <ResultView r={parsed} />
        </div>
      </div>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>② 例外を AppError に包む</div>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 10 }}>外部ライブラリ等が投げる素の <code>Error</code> は <code style={mono}>AppError.from(e, fallback)</code> で包み、境界の外へは Result で出します。</p>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Input value={divA} onChange={(e) => setDivA(e.target.value)} style={{ width: 80 }} /><span>÷</span>
          <Input value={divB} onChange={(e) => setDivB(e.target.value)} style={{ width: 80 }} />
          <span style={{ fontSize: 12, color: "var(--color-muted)" }}>（0 で割ると失敗）</span>
        </div>
        <div style={{ marginTop: 10, padding: 10, background: "var(--color-bg)", borderRadius: "var(--radius)", border: "1px solid var(--color-border)" }}>
          <ResultView r={divided} />
        </div>
      </div>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>③ ErrorCode カタログ（機械可読なエラー種別）</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead><tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
              <th style={th}>ErrorCode</th><th style={th}>使う場面</th><th style={th}>目安の HTTP</th></tr></thead>
            <tbody>{CODES.map((c) => (<tr key={c.code} style={{ borderTop: "1px solid var(--color-border)" }}>
              <td style={td}><code style={{ ...mono, fontWeight: 700 }}>{c.code}</code></td>
              <td style={td}>{c.when}</td><td style={td}><Badge variant="secondary">{c.http}</Badge></td></tr>))}</tbody>
          </table>
        </div>
      </div>

      <Separator style={{ margin: "8px 0 16px" }} />

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>④ 作法（守ること）</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 2 }}>
          <li>起こりうる失敗（入力不正・未検出など）は <strong>例外で投げず Result で返す</strong>。</li>
          <li>素の <code style={mono}>Error</code> ではなく <strong><code style={mono}>AppError</code></strong> を使い、<code style={mono}>ErrorCode</code> で種別を機械可読に。</li>
          <li><code style={mono}>details</code> には <strong>個人情報を入れない</strong>（ログに残るため）。</li>
          <li>呼ぶ側は必ず <code style={mono}>if (!res.ok)</code> で分岐してから <code style={mono}>res.value</code> を使う。</li>
        </ul>
      </div>

      <Alert variant="info" title="この土台はどこにでも出てくる">
        経費（<code>/expenses</code> の writeWorkbook）、決済、Webhook、ジョブ…… ほぼ全ての基盤関数が
        <code style={mono}>Promise&lt;Result&lt;T&gt;&gt;</code> を返します。作法を1つ覚えれば全部同じ書き方で扱えます。
      </Alert>
    </main>
  );
}

const th: React.CSSProperties = { padding: "6px 10px", fontWeight: 600, whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "6px 10px" };
