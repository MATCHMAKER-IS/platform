"use client";
/**
 * freee 会計 連携のデモ。
 * - OAuth（トークンマネージャ）の流れ
 * - FreeeClient の操作カタログ（取引・証憑・振替伝票・人事労務）とサンプル
 *
 * 実 API 呼び出しには OAuth トークンが要るため、ここでは操作の形をサンプルで示す。
 * UI は @platform/ui の部品で組む。
 */
import * as React from "react";
import Link from "next/link";
import { Alert, Separator } from "@platform/ui";

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};
const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" };

type Op = { method: string; desc: string; sample: string };
type Group = { key: string; label: string; ops: Op[] };

const GROUPS: Group[] = [
  {
    key: "basic",
    label: "基本",
    ops: [
      { method: "getMe()", desc: "認証中ユーザー情報", sample: '{ id: 101, email: "keiri@example.co.jp" }' },
      { method: "getCompanies()", desc: "利用可能な事業所一覧", sample: '[{ id: 1, name: "株式会社サンプル", role: "admin" }]' },
    ],
  },
  {
    key: "deals",
    label: "取引（収入・支出）",
    ops: [
      { method: "getDeals(companyId, paging)", desc: "取引一覧", sample: '[{ id: 5001, type: "expense", amount: 12000 }]' },
      { method: "getDeal(companyId, dealId)", desc: "取引詳細", sample: '{ id: 5001, details: [{ account_item_id: 803, amount: 12000 }] }' },
      { method: "createDeal(body)", desc: "取引を作成（body に company_id）", sample: '{ id: 5010, issue_date: "2026-01-31" }' },
      { method: "updateDeal(dealId, body)", desc: "取引を更新", sample: '{ id: 5010, status: "settled" }' },
      { method: "deleteDeal(companyId, dealId)", desc: "取引を削除", sample: '{ ok: true }' },
    ],
  },
  {
    key: "receipts",
    label: "証憑（ファイルボックス）",
    ops: [
      { method: "uploadReceipt(companyId, file, description?)", desc: "領収書などをアップロード（経費の添付に）", sample: '{ id: 9001, mime_type: "image/jpeg" }' },
      { method: "getReceipts(companyId, params?)", desc: "証憑一覧", sample: '[{ id: 9001, issue_date: "2026-01-20" }]' },
      { method: "getReceipt(companyId, receiptId)", desc: "証憑を1件取得", sample: '{ id: 9001, file_src: "https://..." }' },
    ],
  },
  {
    key: "journals",
    label: "振替伝票",
    ops: [
      { method: "createManualJournal(body)", desc: "振替伝票を作成（複合仕訳）", sample: '{ id: 7001, txn_number: "MJ-0001" }' },
    ],
  },
  {
    key: "hr",
    label: "人事労務（別クライアント）",
    ops: [
      { method: "createFreeeHrClient({ accessToken })", desc: "人事労務 API のクライアントを作成", sample: "FreeeHrClient" },
      { method: "getEmployees(companyId)", desc: "従業員一覧", sample: '[{ id: 301, display_name: "山田 太郎" }]' },
    ],
  },
];

export default function Page() {
  const [tab, setTab] = React.useState("deals");
  const group = GROUPS.find((g) => g.key === tab) ?? GROUPS[0]!;

  return (
    <main style={{ maxWidth: 900, margin: "2.5rem auto", padding: "0 1rem" }}>
      <Link href="/integrations" style={{ fontSize: 12, color: "var(--color-primary)" }}>← 外部サービス連携</Link>
      <h1 style={{ fontSize: "1.6rem", fontWeight: 700, margin: "8px 0 6px" }}>freee 会計 連携</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 20, lineHeight: 1.8 }}>
        取引・証憑・振替伝票を <code style={mono}>@platform/freee</code> の <code style={mono}>FreeeClient</code> で扱います。
        <Link href="/expenses" style={{ color: "var(--color-primary)" }}>経費精算デモ</Link> で作った仕訳を、そのまま freee へ送るような使い方が想定です。
      </p>

      {/* OAuth の流れ */}
      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>OAuth（トークン）の流れ</div>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12, lineHeight: 2 }}>
          <li>freee の認可画面でユーザーが同意 → <code style={mono}>redirect_uri</code> に <code style={mono}>code</code> が返る。</li>
          <li>サーバ側で <code style={mono}>code</code> を <strong>access_token / refresh_token</strong> に交換。</li>
          <li><code style={mono}>createFreeeTokenManager(&#123; ... &#125;)</code> にトークンを預けると、期限切れを<strong>自動更新</strong>。</li>
          <li><code style={mono}>createFreeeAuthedFetch(manager)</code> or <code style={mono}>createFreeeClient(&#123; accessToken &#125;)</code> で API を叩く。</li>
        </ol>
      </div>

      {/* 操作カタログ */}
      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>FreeeClient の操作カタログ</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {GROUPS.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => setTab(g.key)}
              style={{
                fontSize: 12, padding: "5px 12px", borderRadius: 999, cursor: "pointer",
                border: "1px solid var(--color-border)",
                background: tab === g.key ? "var(--color-primary)" : "var(--color-bg)",
                color: tab === g.key ? "var(--color-primary-fg)" : "var(--color-fg)",
              }}
            >
              {g.label}
            </button>
          ))}
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {group.ops.map((o) => (
            <div key={o.method} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: 12, background: "var(--color-bg)" }}>
              <code style={{ ...mono, fontWeight: 700 }}>{o.method}</code>
              <div style={{ fontSize: 12, color: "var(--color-muted)", margin: "4px 0 6px" }}>{o.desc}</div>
              <div style={{ fontSize: 11, color: "var(--color-muted)" }}>サンプル:</div>
              <div style={{ ...mono, color: "var(--color-fg)" }}>{o.sample}</div>
            </div>
          ))}
        </div>
      </div>

      <Separator style={{ margin: "20px 0 16px" }} />

      <Alert variant="info" title="戻り値は Result 型">
        すべてのメソッドは <code style={mono}>Promise&lt;Result&lt;unknown&gt;&gt;</code> を返します。呼び出し側は
        <code style={mono}>if (!res.ok) ...</code> でエラー分岐し、成功時は <code style={mono}>res.value</code> を使います
        （@platform/core の統一エラー処理）。証憑アップロードは <code style={mono}>@platform/integrations</code> のマルチパート送信を利用します。
      </Alert>
    </main>
  );
}
