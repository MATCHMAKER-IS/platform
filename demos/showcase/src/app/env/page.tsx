"use client";
/**
 * 環境変数の起動時検証のデモ。**@platform/env の関数を実際に呼んでいる**。
 *
 * process.env をあちこちで直接読むと、設定漏れが「実行中の謎の不具合」として現れる。
 * 起動時に一度だけスキーマで検証し、駄目なら**その場で止める**（fail-fast）のが基盤の方針。
 * ここではブラウザ上で、入力した .env の内容を同じ関数で検証している。
 */
import * as React from "react";
import { z, parseEnv, describeEnv, maskSecrets, renderEnvExample, checkSecretStrength } from "@platform/env";
import { Button, Badge, Alert, Textarea } from "@platform/ui";

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };
const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" };
const th: React.CSSProperties = { textAlign: "left", padding: "6px 8px", color: "var(--color-muted)", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "6px 8px", fontSize: 12.5 };

/** アプリが必要とする設定の定義。ここが唯一の正解表になる。 */
const SCHEMA = z.object({
  DATABASE_URL: z.string().url().describe("接続先のデータベース"),
  PORT: z.coerce.number().int().min(1).max(65535).describe("待ち受けポート"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info").describe("ログの出力レベル"),
  SESSION_SECRET: z.string().min(16).describe("セッション署名の鍵（16文字以上）"),
  ENABLE_CACHE: z.enum(["true", "false"]).optional().describe("キャッシュを使うか"),
});

const DEFAULT_ENV = `DATABASE_URL=postgres://localhost:5432/app
PORT=3000
LOG_LEVEL=info
SESSION_SECRET=please-change-this-very-secret
ENABLE_CACHE=true`;

const BROKEN_ENV = `DATABASE_URL=localhost:5432
PORT=99999
LOG_LEVEL=verbose
SESSION_SECRET=short`;

/** .env 形式のテキストを key=value の object にする。 */
function parseDotenv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]!] = m[2]!.trim();
  }
  return out;
}

export default function Page() {
  const [text, setText] = React.useState(DEFAULT_ENV);
  const [result, setResult] = React.useState<{ ok: true; value: Record<string, unknown> } | { ok: false; issues: { path: string; message: string }[] } | null>(null);

  const values = React.useMemo(() => parseDotenv(text), [text]);
  const infos = React.useMemo(() => describeEnv(SCHEMA), []);
  const weak = React.useMemo(() => checkSecretStrength(values), [values]);

  const run = () => {
    try {
      // 基盤: スキーマ検証（失敗すると AppError を投げる = 起動を止める）
      const value = parseEnv(SCHEMA, values) as Record<string, unknown>;
      setResult({ ok: true, value });
    } catch (e) {
      const details = (e as { details?: { issues?: { path: string; message: string }[] } }).details;
      setResult({ ok: false, issues: details?.issues ?? [{ path: "-", message: String(e) }] });
    }
  };

  return (
    <main style={{ maxWidth: 880, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 6 }}>環境変数の検証（起動時に止める）</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16 }}>
        設定漏れを「実行中の謎の不具合」にせず、<strong>起動の瞬間に止める</strong>ための仕組みです。
        入力した内容を、基盤の <code>parseEnv</code> でその場で検証します。
      </p>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>設定の定義（スキーマ）</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>変数名</th><th style={th}>必須</th><th style={th}>型・許容値</th><th style={th}>説明</th></tr></thead>
          <tbody>
            {infos.map((i) => (
              <tr key={i.name} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ ...td, ...mono }}>{i.name}</td>
                <td style={td}>{i.required ? <Badge variant="danger">必須</Badge> : <Badge variant="secondary">任意</Badge>}</td>
                <td style={{ ...td, color: "var(--color-muted)" }}>{i.type}{i.defaultValue !== undefined && `（既定 ${i.defaultValue}）`}</td>
                <td style={{ ...td, color: "var(--color-muted)" }}>{i.description ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 8, lineHeight: 1.8 }}>
          この表は <code>describeEnv()</code> がスキーマから生成しています。定義を変えれば表も自動で変わるため、説明が実装とズレません。
        </p>
      </div>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>.env の内容</div>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} style={{ width: "100%", fontFamily: "monospace", fontSize: 12.5 }} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <Button onClick={run}>検証する</Button>
          <Button variant="secondary" onClick={() => { setText(DEFAULT_ENV); setResult(null); }}>正しい例</Button>
          <Button variant="secondary" onClick={() => { setText(BROKEN_ENV); setResult(null); }}>間違った例</Button>
        </div>
      </div>

      {result !== null && (
        <div style={{ marginBottom: 16 }}>
          {result.ok ? (
            <Alert variant="success" title="検証に成功しました（起動できます）">
              <div style={{ ...mono, marginTop: 6 }}>{JSON.stringify(maskSecrets(result.value))}</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>
                値の表示には <code>maskSecrets()</code> を通しています。鍵やトークンは伏せられ、そのままログに出しても安全です。
              </div>
            </Alert>
          ) : (
            <Alert variant="danger" title="検証に失敗しました（起動しません）">
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                {result.issues.map((i, n) => (
                  <li key={n} style={{ fontSize: 12.5, lineHeight: 1.8 }}><code>{i.path}</code>: {i.message}</li>
                ))}
              </ul>
              <div style={{ fontSize: 12, marginTop: 8 }}>
                本番でこの状態なら、アプリは<strong>起動を拒否します</strong>。中途半端に動いて後から壊れるより安全だからです。
              </div>
            </Alert>
          )}
        </div>
      )}

      {weak.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Alert variant="warning" title="秘密情報の強度に問題があります">
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {weak.map((w, i) => (
                <li key={i} style={{ fontSize: 12.5, lineHeight: 1.8 }}>
                  <code>{w.name}</code>{" "}
                  <Badge variant={w.level === "error" ? "danger" : "warning"}>{w.level}</Badge>{" "}
                  {w.message}
                </li>
              ))}
            </ul>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              <code>checkSecretStrength()</code> は、短すぎる・使い回しの例に見える鍵を検出します。
            </div>
          </Alert>
        </div>
      )}

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>.env.example の自動生成</div>
        <pre style={{ ...mono, margin: 0, padding: 12, borderRadius: 6, background: "var(--color-bg)", border: "1px solid var(--color-border)", whiteSpace: "pre-wrap" }}>
{renderEnvExample(SCHEMA, { header: "# このファイルはスキーマから自動生成されています" })}
        </pre>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 8, lineHeight: 1.8 }}>
          <code>renderEnvExample()</code> がスキーマから生成します。「.env.example が古くて動かない」という定番のつまずきが無くなります。
          リポジトリでは <code>node tools/check-env-example.mjs</code> がズレを検知します。
        </p>
      </div>
    </main>
  );
}
