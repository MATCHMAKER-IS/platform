"use client";
/**
 * Zoho 連携のデモ。
 * - OAuth 認可 URL の**ライブ生成**（データセンターごとにドメインが変わる点が肝）
 * - CRM / Books / Desk ほか 14 サービスのカタログ
 *
 * UI は @platform/ui の部品で組む。
 */
import * as React from "react";
import Link from "next/link";
import { Button, Input, Badge, Alert, Separator } from "@platform/ui";
import { buildAuthorizationUrl, accountsUrl, type ZohoDataCenter } from "@platform/zoho";

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};
const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" };
const selectStyle: React.CSSProperties = {
  fontSize: 13,
  padding: "6px 8px",
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-fg)",
};

const DATA_CENTERS: { dc: ZohoDataCenter; label: string }[] = [
  { dc: "jp", label: "日本 (.jp)" },
  { dc: "com", label: "US (.com)" },
  { dc: "eu", label: "欧州 (.eu)" },
  { dc: "in", label: "インド (.in)" },
  { dc: "com.au", label: "豪州 (.com.au)" },
  { dc: "ca", label: "カナダ (.ca)" },
];

type Svc = { name: string; factory: string; tag: string; desc: string };
const SERVICES: Svc[] = [
  { name: "CRM", factory: "createZohoCrmClient", tag: "v8", desc: "見込み客・取引先・商談。営業パイプライン。" },
  { name: "Books", factory: "createZohoBooksClient", tag: "v3", desc: "請求書・見積・入出金。会計。" },
  { name: "Desk", factory: "createZohoDeskClient", tag: "v1", desc: "問い合わせ・チケット。カスタマーサポート。" },
  { name: "Inventory", factory: "createZohoInventoryClient", tag: "v1", desc: "在庫・受発注・出荷。" },
  { name: "Campaigns", factory: "createZohoCampaignsClient", tag: "v1.1", desc: "メール配信・リスト管理。" },
  { name: "Projects", factory: "createZohoProjectsClient", tag: "—", desc: "プロジェクト・タスク・工数。" },
  { name: "People", factory: "createZohoPeopleClient", tag: "—", desc: "人事・勤怠・休暇。" },
  { name: "Sign", factory: "createZohoSignClient", tag: "—", desc: "電子署名・契約書の回覧。" },
  { name: "Recruit", factory: "createZohoRecruitClient", tag: "—", desc: "採用・応募者管理。" },
  { name: "WorkDrive", factory: "createZohoWorkDriveClient", tag: "—", desc: "ファイル共有・ドキュメント。" },
  { name: "Analytics", factory: "createZohoAnalyticsClient", tag: "—", desc: "BI・ダッシュボード・レポート。" },
  { name: "Cliq", factory: "createZohoCliqClient", tag: "—", desc: "チャット・通知。" },
  { name: "Creator", factory: "createZohoCreatorClient", tag: "—", desc: "ローコードの業務アプリ。" },
  { name: "Bookings", factory: "createZohoBookingsClient", tag: "—", desc: "予約受付・空き枠。" },
];

export default function Page() {
  const [dc, setDc] = React.useState<ZohoDataCenter>("jp");
  const [clientId, setClientId] = React.useState("1000.DEMOCLIENTID0000000000");
  const [redirectUri, setRedirectUri] = React.useState("https://app.example.co.jp/auth/zoho/callback");
  const [scope, setScope] = React.useState("ZohoCRM.modules.ALL,ZohoBooks.fullaccess.all");
  const [url, setUrl] = React.useState<string | null>(null);

  function generate() {
    setUrl(
      buildAuthorizationUrl({
        dataCenter: dc,
        clientId: clientId.trim(),
        redirectUri: redirectUri.trim(),
        scope: scope.split(",").map((s) => s.trim()).filter(Boolean),
        state: "demo-" + Math.random().toString(36).slice(2, 10),
        accessType: "offline",
      }),
    );
  }

  return (
    <main style={{ maxWidth: 900, margin: "2.5rem auto", padding: "0 1rem" }}>
      <Link href="/integrations" style={{ fontSize: 12, color: "var(--color-primary)" }}>← 外部サービス連携</Link>
      <h1 style={{ fontSize: "1.6rem", fontWeight: 700, margin: "8px 0 6px" }}>Zoho 連携</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 20, lineHeight: 1.8 }}>
        CRM・Books・Desk など 14 サービスを <code style={mono}>@platform/zoho</code> のサブパッケージで扱います。
        <strong>データセンター（DC）ごとにドメインが変わる</strong>のが Zoho の要注意点です。
      </p>

      {/* 認可 URL ライブ生成 */}
      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>① OAuth 認可 URL を組み立てる（ライブ）</div>
        <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>データセンター</div>
            <select value={dc} onChange={(e) => setDc(e.target.value as ZohoDataCenter)} style={selectStyle}>
              {DATA_CENTERS.map((d) => (
                <option key={d.dc} value={d.dc}>{d.label}</option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>Client ID</div>
            <Input value={clientId} onChange={(e) => setClientId(e.target.value)} />
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>Redirect URI</div>
            <Input value={redirectUri} onChange={(e) => setRedirectUri(e.target.value)} />
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>スコープ（カンマ区切り）</div>
            <Input value={scope} onChange={(e) => setScope(e.target.value)} />
          </label>
        </div>
        <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 10 }}>
          この DC の認可ドメイン: <code style={mono}>{accountsUrl(dc)}</code>
        </div>
        <Button onClick={generate}>認可 URL を生成</Button>
        {url !== null && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 4 }}>生成された認可 URL:</div>
            <div style={{ ...mono, padding: 10, background: "var(--color-bg)", borderRadius: "var(--radius)", border: "1px solid var(--color-border)" }}>{url}</div>
          </div>
        )}
      </div>

      <Alert variant="warning" title="DC を間違えると“正しい設定なのに延々と弾かれる”">
        Zoho はアカウントの登録 DC（<code style={mono}>.jp</code> / <code style={mono}>.com</code> / <code style={mono}>.eu</code> …）ごとに
        認可・API のドメインが別です。上でセレクタを切り替えると URL が変わるのが分かります。トークンも DC をまたげません。
      </Alert>

      {/* サービスカタログ */}
      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>② 対応サービス（14）</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
          {SERVICES.map((s) => (
            <div key={s.name} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: 12, background: "var(--color-bg)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{s.name}</span>
                {s.tag !== "—" && <Badge variant="secondary">{s.tag}</Badge>}
              </div>
              <div style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.6, marginBottom: 6 }}>{s.desc}</div>
              <code style={{ ...mono, fontSize: 11, color: "var(--color-primary)" }}>{s.factory}()</code>
            </div>
          ))}
        </div>
      </div>

      <Separator style={{ margin: "20px 0 16px" }} />

      <Alert variant="info" title="クライアントの作り方">
        トークン取得後は <code style={mono}>createZohoCrmClient(&#123; dataCenter, accessToken &#125;)</code> のように
        DC とトークンを渡してクライアントを作ります。期限切れは <code style={mono}>createZohoTokenManager</code> /
        <code style={mono}>refreshAccessToken</code> で更新します。
      </Alert>
    </main>
  );
}
