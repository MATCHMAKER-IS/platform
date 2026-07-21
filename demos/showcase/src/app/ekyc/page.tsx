"use client";
/**
 * eKYC(オンライン本人確認)のデモ。ステータス正規化・webhook の署名検証とパース。
 *
 * UI は **@platform/ui の部品だけ**で組む(CLAUDE.md「UI 部品は @platform/ui を使う」)。
 */
import * as React from "react";
import { Button, Input, Textarea, Badge, Alert, Separator } from "@platform/ui";
import {
  normalizeEkycStatus,
  isEkycFinal,
  isEkycApproved,
  verifyEkycSignature,
  parseEkycWebhook,
  type EkycStatus,
} from "@platform/ekyc";

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" };

const code: React.CSSProperties = {
  ...mono,
  display: "block",
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  borderRadius: 4,
  padding: "8px 10px",
  lineHeight: 1.7,
  whiteSpace: "pre-wrap",
};

const ALL_STATUSES: EkycStatus[] = ["created", "submitted", "in_review", "approved", "rejected", "expired", "canceled", "unknown"];

const STATUS_LABEL: Record<EkycStatus, string> = {
  created: "申込作成済み（未提出）",
  submitted: "書類提出済み（審査待ち）",
  in_review: "審査中",
  approved: "承認（本人確認 OK）",
  rejected: "却下（不備・不一致）",
  expired: "期限切れ",
  canceled: "取消",
  unknown: "不明（マッピング外）",
};

/** ベンダーが返してくる生の値。**サービスごとに違う**。 */
const RAW_SAMPLES = [
  { raw: "approved", vendor: "一般的" },
  { raw: "APPROVED", vendor: "大文字で返すベンダー" },
  { raw: " ok ", vendor: "ok/ng で返すベンダー" },
  { raw: "ng", vendor: "同上（却下）" },
  { raw: "under_review", vendor: "審査中" },
  { raw: "doc_ok", vendor: "★独自語彙（マッピングが要る）" },
  { raw: "謎の値", vendor: "想定外" },
  { raw: "", vendor: "空文字" },
];

/** ベンダーから届く webhook のボディ（フィールド名がバラバラ）。 */
const WEBHOOK_SAMPLES = [
  { label: "TRUSTDOCK 風", body: '{\n  "application_id": "app_20260717_0042",\n  "status": "approved",\n  "verified_at": "2026-07-17T10:00:00Z"\n}' },
  { label: "別ベンダー（result/id）", body: '{\n  "id": "vf_88",\n  "result": "ng",\n  "reason": "顔写真が不鮮明です"\n}' },
  { label: "独自語彙", body: '{\n  "uid": "u_1",\n  "state": "doc_ok"\n}' },
  { label: "壊れたボディ", body: "壊れています" },
  { label: "空", body: "{}" },
];

export default function Page() {
  const [secret, setSecret] = React.useState("ekyc-webhook-secret");
  const [signature, setSignature] = React.useState("");
  const [encoding, setEncoding] = React.useState<"hex" | "base64">("hex");
  const [body, setBody] = React.useState(WEBHOOK_SAMPLES[0]!.body);
  const [useMapping, setUseMapping] = React.useState(false);

  const verified = signature !== "" ? verifyEkycSignature(body, signature, secret, encoding) : null;

  // ★独自語彙は mapping で足す。フィールド名もベンダーごとに違うので指定できる
  const ev = parseEkycWebhook(
    body,
    useMapping ? { idField: "uid", statusField: "state", statusMapping: { doc_ok: "approved", doc_ng: "rejected" } } : undefined,
  );

  return (
    <main style={{ maxWidth: 900, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>eKYC（オンライン本人確認）</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        <strong>判定そのものはベンダーが行います。</strong>基盤の仕事は
        <strong>API 呼び出しと、結果の正規化</strong>です。
        <strong>ベンダーごとに状態名もフィールド名も違う</strong>ので、そこを揃えるのが要点です。
      </p>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>① ステータスの正規化</h2>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 10, lineHeight: 1.8 }}>
          <strong>ベンダーを乗り換えると、状態名が全部変わります。</strong>
          <code>approved</code> / <code>APPROVED</code> / <code>ok</code> / <code>doc_ok</code>——
          アプリ側で <code>if (status === &quot;approved&quot;)</code> と書いていると、<strong>乗り換えで全滅</strong>します。
        </p>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
              <th style={{ padding: 5, width: 120 }}>ベンダーの生の値</th>
              <th style={{ padding: 5, width: 120 }}>正規化後</th>
              <th style={{ padding: 5 }}>備考</th>
            </tr>
          </thead>
          <tbody>
            {RAW_SAMPLES.map((r) => {
              const n = normalizeEkycStatus(r.raw, r.raw === "doc_ok" ? { doc_ok: "approved" } : undefined);
              return (
                <tr key={r.raw || "empty"} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={{ padding: 5, ...mono }}>{r.raw === "" ? "（空文字）" : JSON.stringify(r.raw)}</td>
                  <td style={{ padding: 5 }}>
                    <Badge variant={n === "approved" ? "success" : n === "rejected" ? "danger" : n === "unknown" ? "secondary" : "warning"}>{n}</Badge>
                  </td>
                  <td style={{ padding: 5, fontSize: 11, color: "var(--color-muted)" }}>{r.vendor}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <strong>大文字・前後の空白・別名（ok/ng）は既定で吸収します。</strong>
          独自語彙は <code>normalizeEkycStatus(raw, {"{ doc_ok: \"approved\" }"})</code> で足せます。
          <br />
          <strong>未知の値・空・null はすべて <code>unknown</code></strong>——
          勝手に「承認」にしないのが安全側の設計です。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>② 状態ごとの扱い</h2>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
              <th style={{ padding: 5, width: 100 }}>状態</th>
              <th style={{ padding: 5 }}>意味</th>
              <th style={{ padding: 5, width: 90 }}>確定したか</th>
              <th style={{ padding: 5, width: 80 }}>承認</th>
            </tr>
          </thead>
          <tbody>
            {ALL_STATUSES.map((s) => (
              <tr key={s} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: 5, ...mono }}>{s}</td>
                <td style={{ padding: 5, fontSize: 12, color: "var(--color-muted)" }}>{STATUS_LABEL[s]}</td>
                <td style={{ padding: 5 }}>
                  <Badge variant={isEkycFinal(s) ? "success" : "secondary"}>{isEkycFinal(s) ? "確定" : "待つ"}</Badge>
                </td>
                <td style={{ padding: 5 }}>{isEkycApproved(s) ? <Badge variant="success">OK</Badge> : <span style={{ color: "var(--color-muted)" }}>—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Alert variant="warning" title="unknown は「確定していない」扱いです" style={{ marginTop: 12 }}>
          <span style={{ fontSize: 12, lineHeight: 1.8 }}>
            <strong>マッピングが漏れていても、勝手に却下しません。</strong>
            <code>isEkycFinal(&quot;unknown&quot;)</code> は <b>false</b> なので、
            <strong>待ち続けて人が気づく</strong>形になります。
            <br />
            ここを「不明なら却下」にすると、<strong>ベンダーが新しい状態を増やした日に、
            正当な申込が全部却下されます</strong>。
            <br />
            <code>isEkycFinal()</code> の TSDoc も<strong>「確定していないものは待つ（審査中に督促しても意味がない）」</strong>
            と書いています。
          </span>
        </Alert>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>③ webhook の署名検証</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
          <label style={{ fontSize: 12, flex: 1, minWidth: 180 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>シークレット</div>
            <Input value={secret} onChange={(e) => setSecret(e.target.value)} />
          </label>
          <label style={{ fontSize: 12, flex: 1, minWidth: 180 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>署名ヘッダ</div>
            <Input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="署名を貼る" />
          </label>
          <div style={{ display: "flex", gap: 4 }}>
            {(["hex", "base64"] as const).map((e) => (
              <Button key={e} size="sm" variant={encoding === e ? "primary" : "secondary"} onClick={() => setEncoding(e)}>
                {e}
              </Button>
            ))}
          </div>
          {verified !== null && <Badge variant={verified ? "success" : "danger"}>{verified ? "正当" : "不正"}</Badge>}
        </div>
        <p style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.8 }}>
          <strong>署名のエンコードがベンダーで違います</strong>（hex / base64）。
          第 4 引数で切り替えます——<strong>ここを間違えると「正しい署名なのに弾く」</strong>ことになり、
          全部の判定が届かなくなります。
          <br />
          <code>/line</code> と同じく、<strong>検証はパース前の生ボディ</strong>で行います。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>④ webhook のパース</h2>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {WEBHOOK_SAMPLES.map((s) => (
            <Button key={s.label} size="sm" variant={body === s.body ? "primary" : "secondary"} onClick={() => setBody(s.body)}>
              {s.label}
            </Button>
          ))}
          <Button size="sm" variant={useMapping ? "danger" : "ghost"} onClick={() => setUseMapping((v) => !v)}>
            {useMapping ? "独自語彙の設定: ON" : "独自語彙の設定: OFF"}
          </Button>
        </div>

        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} style={{ marginBottom: 10, fontFamily: "monospace", fontSize: 11 }} />

        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <tbody>
            {[
              { k: "applicationId", v: ev.applicationId ?? "—" },
              { k: "status（正規化後）", v: ev.status, badge: true },
              { k: "rawStatus（生の値）", v: ev.rawStatus ?? "—" },
              { k: "reason", v: ev.reason ?? "—" },
            ].map((r) => (
              <tr key={r.k} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: 5, width: 160, color: "var(--color-muted)", fontSize: 12 }}>{r.k}</td>
                <td style={{ padding: 5, ...mono }}>
                  {r.badge === true ? (
                    <Badge variant={ev.status === "approved" ? "success" : ev.status === "rejected" ? "danger" : "secondary"}>{r.v}</Badge>
                  ) : (
                    r.v
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <Alert variant="danger" title="「壊れたボディ」を押してください" style={{ marginTop: 12 }}>
          <span style={{ fontSize: 12, lineHeight: 1.8 }}>
            <strong>例外を投げず、<code>status: unknown</code> を返します。</strong>
            webhook の入口で throw すると <strong>500 が返り、ベンダーがリトライを繰り返します</strong>。
            <br />
            <strong>「独自語彙」を押して、設定を ON にしてみてください。</strong>
            <code>uid</code> / <code>state</code> / <code>doc_ok</code> という
            ベンダー独自の形が、<strong>正しく解釈されます</strong>。OFF だと <code>unknown</code> のままです。
          </span>
        </Alert>

        <Separator style={{ margin: "14px 0" }} />

        <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 6 }}>
          <code>ev.raw</code> — <strong>生のボディも残ります</strong>（調査に要る）
        </div>
        <span style={code}>{JSON.stringify(ev.raw, null, 2)}</span>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 8, lineHeight: 1.8 }}>
          <strong><code>rawStatus</code> と <code>raw</code> を残すのが要点です。</strong>
          正規化した結果だけ保存すると、<strong>「なぜ却下されたのか」を後から追えません</strong>。
          ベンダーに問い合わせるとき、生の値が要ります（<code>/audit</code> と組み合わせてください）。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>クライアント（ベンダー API）</h2>
        <span style={code}>
{`import { createTrustdockClient } from "@platform/ekyc";

const client = createTrustdockClient({ apiKey: process.env.TRUSTDOCK_KEY });
const r = await client.createApplication({ name: "山田太郎", email: "..." });
if (!r.ok) return; // Result なので握り潰せない

// 汎用クライアント(別ベンダー・エンドポイントを上書き)
const other = createEkycClient({
  apiKey: "...",
  baseUrl: "https://sandbox.other-vendor.jp",
  authHeader: "Authorization",
  apiKeyPrefix: "Bearer ",
  endpoints: { getApplication: "/v2/applications/:id" },  // ★Partial(既定値がある)
});`}
        </span>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <strong><code>createTrustdockClient()</code> はプリセット</strong>です。
          別ベンダーなら <code>createEkycClient()</code> で <strong>URL と認証方式を変えるだけ</strong>——
          <code>createApplication()</code> などの<strong>呼び出し側は変わりません</strong>。
          <br />
          <code>fetchImpl</code> を注入できるので、<strong>テストで本物のベンダーへ送らずに済みます</strong>。
          API キーは<a href="/secrets" style={{ color: "var(--color-primary)" }}>シークレット管理</a>と組み合わせてください。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>基盤が持つもの / 持たないもの</h2>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <tbody>
            {[
              { k: "判定そのもの", v: "ベンダー", note: "書類と顔写真の照合。基盤は関与しない" },
              { k: "API 呼び出し", v: "基盤", note: "createEkycClient / createTrustdockClient" },
              { k: "ステータス正規化", v: "基盤", note: "**ベンダーを乗り換えてもアプリは変わらない**" },
              { k: "署名検証", v: "基盤", note: "hex / base64 の違いも吸収" },
              { k: "本人確認が要るかの判断", v: "アプリ", note: "業務ルール（金額・取引種別）" },
            ].map((r) => (
              <tr key={r.k} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: 5, width: 160 }}>{r.k}</td>
                <td style={{ padding: 5, width: 80 }}>
                  <Badge variant={r.v === "基盤" ? "default" : "outline"}>{r.v}</Badge>
                </td>
                <td style={{ padding: 5, fontSize: 11, color: "var(--color-muted)" }}>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <strong>eKYC は法令（犯収法）に基づく手続き</strong>なので、
          <strong>ベンダーの認定が要ります</strong>。自作はできません。
          基盤の役割は<strong>「どのベンダーでも同じコードで扱える」</strong>ようにすることだけです。
        </p>
      </div>
    </main>
  );
}
