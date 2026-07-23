"use client";
/**
 * Google Workspace 連携のデモ。
 * - OAuth 認可 URL の**ライブ生成**（buildGoogleAuthUrl は純粋関数なので実際に動く）
 * - Sheets / Calendar / Maps クライアントの操作カタログとサンプル
 *
 * UI は @platform/ui の部品で組む。
 */
import * as React from "react";
import Link from "next/link";
import { Alert, Button, Input, Separator } from "@platform/ui";
import { buildGoogleAuthUrl } from "@platform/google";

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

type ScopePreset = { key: string; label: string; scopes: string[] };
const SCOPE_PRESETS: ScopePreset[] = [
  { key: "basic", label: "基本（ログイン）", scopes: ["openid", "email", "profile"] },
  { key: "sheets", label: "Sheets（表計算）", scopes: ["https://www.googleapis.com/auth/spreadsheets"] },
  { key: "calendar", label: "Calendar（予定）", scopes: ["https://www.googleapis.com/auth/calendar"] },
  { key: "all", label: "まとめて", scopes: ["openid", "email", "https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/calendar"] },
];

type Op = { client: string; method: string; desc: string; sample: string };
const OPS: Op[] = [
  { client: "Sheets", method: "getValues(sheetId, range)", desc: "指定範囲を読み取る", sample: '{ range: "A1:C2", values: [["月","売上","費用"],["1月",500,300]] }' },
  { client: "Sheets", method: "updateValues(sheetId, range, values)", desc: "範囲に書き込む（帳票の吐き出し）", sample: '{ updatedCells: 6 }' },
  { client: "Sheets", method: "appendRows(sheetId, range, rows)", desc: "末尾に行を追加", sample: '{ updates: { updatedRows: 3 } }' },
  { client: "Calendar", method: "listEvents(calendarId, params)", desc: "期間内の予定を取得", sample: '[{ id:"ev_1", summary:"棚卸し", start:"2026-02-01T09:00" }]' },
  { client: "Calendar", method: "createEvent(calendarId, event)", desc: "予定を作成（予約の確定など）", sample: '{ id:"ev_2", htmlLink:"https://calendar.google.com/..." }' },
  { client: "Maps", method: "geocode(address)", desc: "住所 → 緯度経度", sample: '{ lat: 35.681, lng: 139.767, formatted:"東京都千代田区丸の内1" }' },
  { client: "Maps", method: "directions(origin, dest)", desc: "経路と所要時間", sample: '{ distanceKm: 6.2, durationMin: 18 }' },
];

const CLIENTS = ["Sheets", "Calendar", "Maps"] as const;

export function GoogleDemo() {
  const [clientId, setClientId] = React.useState("1234567890-demo.apps.googleusercontent.com");
  const [redirectUri, setRedirectUri] = React.useState("https://app.example.co.jp/auth/google/callback");
  const [presetKey, setPresetKey] = React.useState("sheets");
  const [url, setUrl] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<(typeof CLIENTS)[number]>("Sheets");

  const preset = SCOPE_PRESETS.find((p) => p.key === presetKey) ?? SCOPE_PRESETS[0]!;

  function generate() {
    setUrl(
      buildGoogleAuthUrl({
        clientId: clientId.trim(),
        redirectUri: redirectUri.trim(),
        scopes: preset.scopes,
        state: "demo-" + Math.random().toString(36).slice(2, 10),
        offline: true,
      }),
    );
  }

  return (
    <>
      <Link href="/integrations" style={{ fontSize: 12, color: "var(--color-primary)" }}>← 外部サービス連携</Link>
      <h1 style={{ fontSize: "1.6rem", fontWeight: 700, margin: "8px 0 6px" }}>Google Workspace 連携</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 20, lineHeight: 1.8 }}>
        Sheets・Calendar・Maps を <code style={mono}>@platform/google</code> のクライアントで扱います。
        下の認可 URL 生成は <strong>実際に動きます</strong>（純粋関数）。
      </p>

      {/* 認可 URL ライブ生成 */}
      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>① OAuth 認可 URL を組み立てる（ライブ）</div>
        <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>Client ID</div>
            <Input value={clientId} onChange={(e) => setClientId(e.target.value)} />
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>Redirect URI</div>
            <Input value={redirectUri} onChange={(e) => setRedirectUri(e.target.value)} />
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>スコープ</div>
            <select value={presetKey} onChange={(e) => setPresetKey(e.target.value)} style={selectStyle}>
              {SCOPE_PRESETS.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 10 }}>
          要求スコープ: {preset.scopes.map((s) => <code key={s} style={{ ...mono, marginRight: 6 }}>{s}</code>)}
        </div>
        <Button onClick={generate}>認可 URL を生成</Button>
        {url !== null && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 4 }}>生成された認可 URL（ここへユーザーを飛ばす）:</div>
            <div style={{ ...mono, padding: 10, background: "var(--color-bg)", borderRadius: "var(--radius)", border: "1px solid var(--color-border)" }}>{url}</div>
          </div>
        )}
      </div>

      {/* 操作カタログ */}
      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>② クライアントの操作カタログ</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {CLIENTS.map((c) => (
            <Button
              key={c}
              type="button"
              onClick={() => setTab(c)}
              style={{
                fontSize: 12, padding: "5px 12px", borderRadius: 999, cursor: "pointer",
                border: "1px solid var(--color-border)",
                background: tab === c ? "var(--color-primary)" : "var(--color-bg)",
                color: tab === c ? "var(--color-primary-fg)" : "var(--color-fg)",
              }}
            >
              {c}
            </Button>
          ))}
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {OPS.filter((o) => o.client === tab).map((o) => (
            <div key={o.method} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: 12, background: "var(--color-bg)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <code style={{ ...mono, fontWeight: 700 }}>{o.method}</code>
              </div>
              <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 6 }}>{o.desc}</div>
              <div style={{ fontSize: 11, color: "var(--color-muted)" }}>サンプル応答:</div>
              <div style={{ ...mono, color: "var(--color-fg)" }}>{o.sample}</div>
            </div>
          ))}
        </div>
      </div>

      <Separator style={{ margin: "20px 0 16px" }} />

      <Alert variant="info" title="クライアントの作り方">
        トークン取得後は <code style={mono}>createGoogleSheetsClient(&#123; accessToken &#125;)</code> /
        <code style={mono}>createGoogleCalendarClient(...)</code> /
        <code style={mono}>createGoogleMapsClient(&#123; apiKey &#125;)</code> でクライアントを作成し、上のメソッドを呼びます。
        期限切れは <code style={mono}>createGoogleTokenManager</code> が自動更新します。
      </Alert>
    </>
  );
}
