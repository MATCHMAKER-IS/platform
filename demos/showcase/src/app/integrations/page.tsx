"use client";
/**
 * 外部サービス連携のハブ。
 *
 * freee / Google / Zoho など各サービスの入口をまとめ、共通の土台
 * （@platform/integrations の型付き HTTP クライアントと OAuth の流れ）を説明する。
 *
 * UI は @platform/ui の部品で組む（CLAUDE.md「UI 部品は @platform/ui を使う」）。
 */
import * as React from "react";
import Link from "next/link";
import { Alert, Badge, Separator } from "@platform/ui";

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" };

type Service = {
  href: string;
  name: string;
  tag: string;
  summary: string;
  ops: string[];
};

const SERVICES: Service[] = [
  {
    href: "/freee",
    name: "freee 会計",
    tag: "会計・経費",
    summary: "取引・証憑（ファイルボックス）・振替伝票・人事労務。経費精算やレシートの証憑添付に。",
    ops: ["取引 CRUD", "証憑アップロード", "振替伝票", "事業所/勘定科目"],
  },
  {
    href: "/google",
    name: "Google Workspace",
    tag: "表計算・予定・地図",
    summary: "Sheets（帳票の書き出し）・Calendar（予約/予定）・Maps（住所→座標・経路）。OAuth 認可 URL の生成もライブで。",
    ops: ["Sheets 読み書き", "Calendar 予定", "Maps ジオコーディング", "認可 URL 生成"],
  },
  {
    href: "/zoho",
    name: "Zoho",
    tag: "CRM・業務スイート",
    summary: "CRM / Books / Desk / Inventory ほか 14 サービス。データセンター（.jp 等）ごとにドメインが変わる点に注意。",
    ops: ["14 サービス", "DC 別ドメイン", "認可 URL 生成", "トークン更新"],
  },
  {
    href: "/connect",
    name: "Microsoft 365 / Entra ID",
    tag: "認証・メール・予定",
    summary: "Entra ID の OAuth と Microsoft Graph。Outlook のメール送信、予定と Teams 会議、社員情報の取得。テナントは必ず自社の ID を指定する（common は他社アカウントも通る）。",
    ops: ["OAuth（テナント指定）", "メール送信", "予定 / Teams 会議", "社員情報"],
  },
  {
    href: "/connect",
    name: "Slack",
    tag: "通知・受信",
    summary: "通知を送るだけなら @platform/notify の Webhook で足りる。スレッド返信・メッセージ更新・受信（イベント/スラッシュコマンド）が要るときに @platform/slack を使う。受信は署名検証が必須。",
    ops: ["スレッド返信", "メッセージ更新", "利用者照会", "受信の署名検証"],
  },
  {
    href: "/connect",
    name: "Notion",
    tag: "ドキュメント・案件管理",
    summary: "議事録・手順書・案件管理の読み書き。入れ子の深いプロパティを平たい値にして返す。連携先をインテグレーションに共有し忘れると 404 になる点に注意。",
    ops: ["DB 照会", "ページ作成 / 更新", "本文取得", "プロパティの平坦化"],
  },
];

const FOUNDATION: { title: string; body: string }[] = [
  { title: "型付き HTTP クライアント", body: "createApiClient() が fetch のラップ・JSON 変換・型付きレスポンスを提供。各連携が個別に書かない。" },
  { title: "タイムアウト & リトライ", body: "遅い/落ちた API に無限に待たされない。指数バックオフで一時的な失敗を吸収する。" },
  { title: "エラーの正規化", body: "HTTP エラーやネットワーク失敗を AppError（@platform/core の Result 型）へ統一。呼び出し側は ok/error で分岐するだけ。" },
  { title: "マルチパート送信", body: "証憑・画像などのファイルアップロードを共通の MultipartBody で扱う。" },
];

export default function Page() {
  return (
    <main style={{ maxWidth: 900, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: 6 }}>外部サービス連携</h1>
      <div style={{ marginBottom: 16 }}>
        <Alert variant="info" title="必要な鍵を確かめる">
          各サービスの連携に何が必要か、いまの値で本当に通るかは <Link href="/connect" style={{ color: "var(--color-primary)" }}>接続チェック</Link> で確認できます。
        </Alert>
      </div>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 20, lineHeight: 1.8 }}>
        freee・Google・Zoho など外部 SaaS との連携。すべて <code style={mono}>@platform/integrations</code> の
        共通土台の上に載っており、各サービスは「型付きクライアント＋ OAuth」という同じ形で扱えます。
      </p>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>共通の土台 — @platform/integrations</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
          {FOUNDATION.map((f) => (
            <div key={f.title} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: 12, background: "var(--color-bg)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{f.title}</div>
              <div style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.7 }}>{f.body}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, margin: "20px 0 10px" }}>サービス別デモ</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {SERVICES.map((s) => (
          <Link key={s.href} href={s.href} style={{ textDecoration: "none", color: "inherit" }}>
            <div style={{ ...box, marginBottom: 0, height: "100%", transition: "border-color .15s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{s.name}</span>
                <Badge variant="secondary">{s.tag}</Badge>
              </div>
              <div style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.7, marginBottom: 10 }}>{s.summary}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {s.ops.map((o) => (
                  <span key={o} style={{ fontSize: 11, color: "var(--color-primary)", border: "1px solid var(--color-border)", borderRadius: 999, padding: "1px 8px" }}>{o}</span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <Separator style={{ margin: "24px 0 16px" }} />

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>OAuth の共通フロー</div>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12, lineHeight: 2, color: "var(--color-fg)" }}>
          <li><strong>認可 URL を組み立てる</strong>（clientId・redirectUri・スコープ・state）。Google/Zoho はこのページ内でライブ生成できます。</li>
          <li>ユーザーをその URL へ飛ばし、同意後に <code style={mono}>redirectUri</code> に <code style={mono}>code</code> が返る。</li>
          <li>サーバ側で <code style={mono}>code</code> を <strong>アクセストークン＋リフレッシュトークン</strong>に交換する。</li>
          <li>以降はトークンでクライアントを作成（例 <code style={mono}>createFreeeClient(&#123; accessToken &#125;)</code>）。期限切れは <strong>トークンマネージャが自動更新</strong>。</li>
        </ol>
      </div>

      <Alert variant="info" title="このデモで“実際に叩ける”のは認可 URL の生成まで">
        API 本体の呼び出しには OAuth トークン（サーバ側の Secrets）が必要なため、各ページでは
        <strong>操作カタログ・リクエスト/レスポンスの形・OAuth の流れ</strong>をサンプルデータで示します。
        トークン発行後は、ここに並ぶ関数をそのまま呼ぶだけで動きます。
      </Alert>
    </main>
  );
}
