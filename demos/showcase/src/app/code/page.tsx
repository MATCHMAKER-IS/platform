"use client";
/** ソースコード表示のデモ（シンタックスハイライト＋行番号＋コピー）。 */
import * as React from "react";
import { Button, Textarea } from "@platform/ui";
import { CodeBlock } from "../../components/code-block";
import { CodeDiff } from "../../components/code-diff";

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

const DIFF_BEFORE = `export function calcTotal(items) {
  let sum = 0;
  for (const it of items) {
    sum += it.price * it.qty;
  }
  return sum;
}`;

const DIFF_AFTER = `export function calcTotal(items: Item[]): number {
  let sum = 0;
  for (const it of items) {
    // 税抜きで積み上げ、最後にまとめて課税する(端数の出方が変わるため)
    sum += it.price * it.qty;
  }
  return roundDown(sum);
}`;

export default function Page() {
  const [diffSplit, setDiffSplit] = React.useState(false);
  const [diffCollapse, setDiffCollapse] = React.useState(false);
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

      <div style={{ marginTop: 24, marginBottom: 8, fontSize: 13, fontWeight: 700 }}>変更の比較（差分）</div>
      <p style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.8, margin: "0 0 10px" }}>
        追加した行を緑、消した行をピンクで示します。差分の計算は <code>@platform/cms</code> の
        <code>diffLines</code>（LCS ベース）で、行を挿入しても後続がずれません。
        リビジョンの比較や、承認前に「何が変わるか」を見せる場面で使います。
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <Button size="sm" variant={diffSplit ? "secondary" : "primary"} onClick={() => setDiffSplit(false)}>1 列で見る</Button>
        <Button size="sm" variant={diffSplit ? "primary" : "secondary"} onClick={() => setDiffSplit(true)}>左右で見る</Button>
        <Button size="sm" variant="secondary" onClick={() => setDiffCollapse((v) => !v)}>
          {diffCollapse ? "変更のない行も出す" : "変更のない行を省く"}
        </Button>
      </div>
      <CodeDiff before={DIFF_BEFORE} after={DIFF_AFTER} split={diffSplit} collapseUnchanged={diffCollapse} />

      <p style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.8, marginTop: 16 }}>
        ハイライトは軽量な自前トークナイザ（コメント・文字列・キーワード・数値）。ドキュメントや管理画面でのコード掲載に使えます。
      </p>
    </main>
  );
}
