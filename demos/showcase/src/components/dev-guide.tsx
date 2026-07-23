/** 新人向け：この基盤での開発の流れガイド（トップページ上部に表示）。 */
import type * as React from "react";
import Link from "next/link";
import { CodeBlock } from "./code-block";

type Ref = { demos?: [string, string][]; docs?: string[] };
type Step = { n: number; title: string; body: React.ReactNode } & Ref;

const STEPS: Step[] = [
  { n: 1, title: "準備する", body: <>取得して <code>pnpm install</code>。まず <code>pnpm doctor</code> で Node / pnpm / .env / 生成物の状態を診断（読み取りのみで安全）。</>,
    docs: ["docs/ops/GETTING_STARTED.md", "docs/ops/COMMANDS.md"] },
  { n: 2, title: "動かす", body: <><code>pnpm dev</code> で全アプリ起動（ポート固定）。社内アプリは <code>:3000</code>（<code>dev:internal</code>）、このデモは <code>:3001</code>（<code>dev:demos</code>）。</>,
    demos: [["/", "このデモ一覧"]], docs: ["docs/ops/COMMANDS.md"] },
  { n: 3, title: "画面を作る", body: <><code>apps/</code> に Next.js の画面を追加。独自ロジックは最小限に、基盤 <code>@platform/…</code> の部品・関数を組み合わせる（このサイトが実例集）。</>,
    demos: [["/ui", "UI部品"], ["/master", "CRUDの実例"]], docs: ["docs/ai/patterns.md"] },
  { n: 4, title: "作法を守る", body: <>UI は <code>@platform/ui</code>、失敗は <code>Result</code>/<code>AppError</code>、ログは <code>@platform/logger</code>、環境変数は <code>@platform/env</code> で検証。詳細は下の「守ること」。</>,
    demos: [["/core", "Result/AppError"], ["/logger", "ログ"], ["/env", "環境変数"]], docs: ["docs/ai/patterns.md", "CLAUDE.md"] },
  { n: 5, title: "確認する", body: <><code>pnpm check</code>（型＋lint＋smoke）で最終確認。<code>pnpm test</code> でユニット、<code>pnpm gen:all</code> で生成物の drift ゼロを確認。</>,
    docs: ["docs/ops/TESTING_GUIDE.md", "docs/ops/COMMANDS.md"] },
];

type Scenario = { title: string; body: React.ReactNode } & Ref;
const SCENARIOS: Scenario[] = [
  { title: "新しい画面を作りたい", body: <><code>apps/</code> に page 追加 → <code>@platform/ui</code> で組む → 状態は「memory＋prisma」両実装のストア → API は「認可＋観測＋監査」でラップ → <code>tools/smoke.mjs</code> に確認を1本追加。</>,
    demos: [["/master", "一覧・登録・編集・削除"], ["/inquiries", "フォーム"]], docs: ["docs/ai/patterns.md"] },
  { title: "既存の画面を直したい", body: <>該当する <code>apps/</code> を編集 → 生タグや直書きがあれば <code>@platform/ui</code> の部品に置換 → <code>pnpm check</code> で壊れていないか確認。テーマ切替や a11y は部品側に追従します。</>,
    demos: [["/ui", "置き換え先の部品"], ["/theme", "テーマ機構"]] },
  { title: "基盤に機能を足したい", body: <><code>packages/</code> に <strong>「追加のみ（additive）」</strong>で実装 → <code>api-surface</code> で破壊的変更なしを確認 → デモに反映。既存アプリを壊さず拡張できます（このサイトの多くがこの流れで育ちました）。</>,
    demos: [["/error-pages", "status-page拡張の例"], ["/schedule", "カレンダー拡張の例"]], docs: ["docs/ai/patterns.md"] },
];

const RULES: [string, string][] = [
  ["UI は生タグを使わない", "Button / Input / Select など @platform/ui を使う（スキン・アクセシビリティが全アプリに一括で追従）"],
  ["失敗は例外でなく Result で返す", "ok() / err(AppError)。呼ぶ側は if (!res.ok) で分岐（/core 参照）"],
  ["console.log は使わない", "@platform/logger で構造化ログ。password / token は自動マスク"],
  ["process.env を直接読まない", "@platform/env で起動時に一括検証（fail-fast）。設定ミスは本番前に止める"],
  ["業務ロジックは基盤に置かない", "packages/ は再利用部品と作法、業務ロジックは apps/ 側に書く"],
];

const SHORTCUTS: [string, string][] = [
  ["/core", "作法(Result/AppError)"], ["/ui", "UI 部品の一覧"], ["/master", "CRUD の実例"],
  ["/schedule", "カレンダーの実例"], ["/error-pages", "エラー画面"], ["/faq", "よくある質問"],
];

const EXAMPLE_UI = `// ❌ 生タグ + 直書き（サイズ・色・アクセシビリティが基盤に追従しない）
<Button className="rounded bg-neutral-900 px-3 py-1.5 text-white">保存</Button>

// ✅ 基盤の部品を使う
import { Button, Input } from "@platform/ui";
import { ok, err, AppError, ErrorCode } from "@platform/core";

<Button>保存</Button>
<Input placeholder="氏名" />

// 起こりうる失敗は例外を投げず Result で返す
function parseName(input: string) {
  if (!input.trim()) return err(new AppError(ErrorCode.VALIDATION, "氏名は必須です"));
  return ok(input.trim());
}`;

const EXAMPLE_API = `// API ルート: 認可 + 観測 + 監査（apps/*/src/app/api/**/route.ts）
// withApiObservability / currentUser は各アプリの server/ から import して使う

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(/* session cookie */);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  // requirePermission(user, "xxx:read");   // 権限が要るときだけ
  return Response.json({ ok: true });
}
// 観測（レイテンシ・エラー）を自動計測してエクスポート
export const GET = withApiObservability("/api/xxx", handleGET);`;

const card: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: 12, background: "var(--color-surface)", padding: 20, marginBottom: 40 };
const demoChip: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, padding: "3px 9px", borderRadius: 999, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)", textDecoration: "none" };
const docChip: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, padding: "3px 9px", borderRadius: 999, border: "1px dashed var(--color-border)", background: "transparent", color: "var(--color-muted)" };

function RefRow({ demos, docs }: Ref) {
  if (!demos && !docs) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
      {demos?.map(([href, label]) => (
        <Link key={href} href={href} style={demoChip}>▶ {label} <code style={{ opacity: 0.65 }}>{href}</code></Link>
      ))}
      {docs?.map((d) => (<span key={d} style={docChip}>📄 <code>{d}</code></span>))}
    </div>
  );
}

export function DevGuide() {
  return (
    <section style={card}>
      <h2 style={{ fontSize: 19, margin: "0 0 6px" }}>はじめての方へ — この基盤での開発の流れ</h2>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.9, margin: "0 0 18px" }}>
        これは<strong>再利用できる部品（<code>packages/@platform/…</code>）</strong>と<strong>業務アプリ（<code>apps/</code>）</strong>を1つにしたモノレポです。
        部品を組み合わせて、<strong>速く・同じ作法で</strong>アプリを作ります。このサイトはその部品の“動く実例集”です（▶ はデモへのリンク、📄 はリポジトリ内の資料）。
      </p>

      <ol style={{ listStyle: "none", margin: "0 0 22px", padding: 0, display: "grid", gap: 14 }}>
        {STEPS.map((s) => (
          <li key={s.n} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 999, background: "var(--color-primary)", color: "var(--color-primary-fg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>{s.n}</span>
            <div style={{ fontSize: 13, lineHeight: 1.7 }}>
              <strong>{s.title}</strong><span style={{ color: "var(--color-muted)" }}> — {s.body}</span>
              <RefRow demos={s.demos} docs={s.docs} />
            </div>
          </li>
        ))}
      </ol>

      <div style={{ fontSize: 14, fontWeight: 700, margin: "0 0 10px" }}>よくある分岐（やりたいこと別）</div>
      <div style={{ display: "grid", gap: 12, marginBottom: 22 }}>
        {SCENARIOS.map((s) => (
          <div key={s.title} style={{ border: "1px solid var(--color-border)", borderRadius: 10, background: "var(--color-bg)", padding: "12px 14px" }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>「{s.title}」</div>
            <div style={{ fontSize: 12.5, color: "var(--color-muted)", lineHeight: 1.8 }}>{s.body}</div>
            <RefRow demos={s.demos} docs={s.docs} />
          </div>
        ))}
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px" }}>守ること（属人化・ブラックボックス化を防ぐ）</div>
      <ul style={{ margin: "0 0 22px", paddingLeft: 18, display: "grid", gap: 6 }}>
        {RULES.map(([t, d]) => (<li key={t} style={{ fontSize: 13, lineHeight: 1.7 }}><strong>{t}</strong><span style={{ color: "var(--color-muted)" }}> — {d}</span></li>))}
      </ul>

      <div style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px" }}>コード例①：UI と Result（生タグ ❌ / 基盤 ✅）</div>
      <div style={{ marginBottom: 18 }}><CodeBlock code={EXAMPLE_UI} lang="tsx" /></div>

      <div style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px" }}>コード例②：API ルート（認可＋観測＋監査）</div>
      <div style={{ marginBottom: 22 }}><CodeBlock code={EXAMPLE_API} lang="ts" /></div>

      <div style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px" }}>まず見るべきデモ</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {SHORTCUTS.map(([href, label]) => (
          <Link key={href} href={href} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, padding: "6px 12px", borderRadius: 999, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)", textDecoration: "none" }}>
            <code style={{ color: "var(--color-primary)" }}>{href}</code><span style={{ color: "var(--color-muted)" }}>{label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
