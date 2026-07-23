"use client";
/** ソースコード表示のデモ（シンタックスハイライト＋行番号＋コピー）。 */
import * as React from "react";
import { Textarea } from "@platform/ui";
import { CodeBlock } from "../../components/code-block";

const SAMPLE_TS = `import { ok, err, AppError, ErrorCode } from "@platform/core";

// 起こりうる失敗は例外でなく Result で返す
function parsePositiveInt(input: string) {
  const n = Number(input);
  if (!Number.isInteger(n) || n <= 0) {
    return err(new AppError(ErrorCode.VALIDATION, "正の整数を入力してください"));
  }
  return ok(n); // 成功
}`;

const SAMPLE_TSX = `export function Counter({ start = 0 }: { start?: number }) {
  const [count, setCount] = useState(start);
  return (
    <Button onClick={() => setCount((c) => c + 1)}>
      現在: {count}
    </Button>
  );
}`;

const SAMPLE_JSON = `{
  "name": "@platform/ui",
  "version": "1.0.0",
  "private": true,
  "peerDependencies": { "react": "^19.0.0" }
}`;

export default function Page() {
  const [custom, setCustom] = React.useState(SAMPLE_TS);
  return (
    <main style={{ maxWidth: 860, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 6 }}>ソースコード表示</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16 }}>シンタックスハイライト・行番号・ワンクリックのコピーに対応。TypeScript / TSX / JSON など。</p>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>TypeScript</div>
        <CodeBlock code={SAMPLE_TS} lang="ts" />
      </div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>TSX（React）</div>
        <CodeBlock code={SAMPLE_TSX} lang="tsx" />
      </div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>JSON</div>
        <CodeBlock code={SAMPLE_JSON} lang="json" />
      </div>

      <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 700 }}>自分のコードを貼って試す</div>
      <Textarea value={custom} onChange={(e) => setCustom(e.target.value)} rows={6}
        style={{ width: "100%", fontFamily: "monospace", fontSize: 12, padding: 10, borderRadius: "var(--radius)", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)", marginBottom: 12 }} />
      <CodeBlock code={custom} lang="ts" />

      <p style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.8, marginTop: 16 }}>
        ハイライトは軽量な自前トークナイザ（コメント・文字列・キーワード・数値）。ドキュメントや管理画面でのコード掲載に使えます。
      </p>
    </main>
  );
}
