"use client";
/**
 * LINE 連携のデモ。署名検証・webhook のパース・メッセージ組み立て。
 *
 * UI は **@platform/ui の部品だけ**で組む(CLAUDE.md「UI 部品は @platform/ui を使う」)。
 */
import * as React from "react";
import { Button, Input, Textarea, Badge, Alert, Separator } from "@platform/ui";
import {
  verifyLineSignature,
  parseLineWebhook,
  parsePostbackData,
  eventSourceId,
  lineRecipientType,
  isValidLineRecipient,
  textMessage,
  stickerMessage,
  imageMessage,
  locationMessage,
  messageAction,
  postbackAction,
  uriAction,
  withQuickReply,
  buttonsTemplate,
  confirmTemplate,
  carouselTemplate,
  flexMessage,
  type LineMessage,
  type LineRecipientType,
} from "@platform/line";

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
  maxHeight: 220,
  overflow: "auto",
};

const RECIPIENT_LABEL: Record<LineRecipientType, string> = {
  user: "個人（U…）",
  group: "グループ（C…）",
  room: "複数人トーク（R…）",
  unknown: "不明（送れない）",
};

/** LINE から実際に来るボディの例。 */
const WEBHOOK_SAMPLES = [
  {
    label: "テキスト受信",
    body: JSON.stringify(
      {
        destination: "Uxxxxxxxx",
        events: [
          {
            type: "message",
            replyToken: "r1",
            source: { type: "user", userId: "U1234567890abcdef1234567890abcdef" },
            timestamp: 1752739200000,
            message: { type: "text", id: "m1", text: "経費の申請どうなってますか？" },
          },
        ],
      },
      null,
      2,
    ),
  },
  {
    label: "ボタン押下（postback）",
    body: JSON.stringify(
      {
        destination: "Uxxxxxxxx",
        events: [
          {
            type: "postback",
            replyToken: "r2",
            source: { type: "group", groupId: "C1234567890abcdef1234567890abcdef", userId: "U1234567890abcdef1234567890abcdef" },
            timestamp: 1752739200000,
            postback: { data: "action=approve&id=42&note=%E7%A2%BA%E8%AA%8D%E6%B8%88" },
          },
        ],
      },
      null,
      2,
    ),
  },
  { label: "壊れたボディ", body: "壊れています" },
  { label: "events が無い", body: '{"destination":"U1"}' },
];

const MESSAGE_SAMPLES: { label: string; build: () => LineMessage }[] = [
  { label: "テキスト", build: () => textMessage("経費申請を承認しました。") },
  { label: "クイックリプライ", build: () => withQuickReply(textMessage("どうしますか？"), [messageAction("承認", "承認します"), messageAction("却下", "却下します"), uriAction("詳細を見る", "https://portal.example.co.jp/expenses/42")]) },
  {
    label: "ボタンテンプレート",
    build: () =>
      buttonsTemplate({
        altText: "経費申請の承認依頼",
        title: "経費申請 #42",
        text: "山田太郎さんから ¥12,800（交通費）",
        actions: [postbackAction("承認", "action=approve&id=42", "承認しました"), postbackAction("却下", "action=reject&id=42", "却下しました"), uriAction("詳細", "https://portal.example.co.jp/expenses/42")],
        thumbnailImageUrl: "https://portal.example.co.jp/img/expense.png",
      }),
  },
  { label: "確認（はい/いいえ）", build: () => confirmTemplate("承認しますか？", "経費申請 #42 を承認しますか？", postbackAction("はい", "action=approve&id=42"), postbackAction("いいえ", "action=reject&id=42")) },
  {
    label: "カルーセル",
    build: () =>
      carouselTemplate("承認待ちの申請", [
        { title: "経費 #42", text: "山田太郎 ¥12,800", actions: [postbackAction("承認", "action=approve&id=42")] },
        { title: "経費 #43", text: "鈴木花子 ¥3,200", actions: [postbackAction("承認", "action=approve&id=43")] },
      ]),
  },
  { label: "スタンプ", build: () => stickerMessage("446", "1988") },
  { label: "画像", build: () => imageMessage("https://portal.example.co.jp/img/chart.png", "https://portal.example.co.jp/img/chart-s.png") },
  { label: "位置情報", build: () => locationMessage({ title: "本社", address: "東京都千代田区…", latitude: 35.6812, longitude: 139.7671 }) },
  { label: "Flex", build: () => flexMessage("経費申請 #42", { type: "bubble", body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "経費申請 #42", weight: "bold", size: "lg" }, { type: "text", text: "¥12,800", size: "xxl", color: "#1DB446" }] } }) },
];

const RECIPIENTS = [
  "U1234567890abcdef1234567890abcdef",
  "C1234567890abcdef1234567890abcdef",
  "R1234567890abcdef1234567890abcdef",
  "U123",
  "invalid-id",
];

export default function Page() {
  const [secret, setSecret] = React.useState("my-channel-secret");
  const [body, setBody] = React.useState(WEBHOOK_SAMPLES[0]!.body);
  const [signature, setSignature] = React.useState("");
  const [msgIndex, setMsgIndex] = React.useState(1);
  const [recipient, setRecipient] = React.useState(RECIPIENTS[0]!);

  const verified = signature !== "" ? verifyLineSignature(body, signature, secret) : null;
  const events = parseLineWebhook(body);
  const msg = MESSAGE_SAMPLES[msgIndex]!.build();
  const rt = lineRecipientType(recipient);

  return (
    <main style={{ maxWidth: 900, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>LINE 連携</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        承認依頼を LINE に流し、ボタンで承認してもらう——<strong>PC を開かない現場に効きます</strong>。
        <code>@platform/line</code> は<strong>署名検証・webhook のパース・メッセージの組み立て</strong>を持ちます。
        <strong>単純な通知だけなら <code>@platform/notify</code> の LINE チャネルで足ります。</strong>
      </p>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>① 署名の検証（必ず通す）</h2>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
          <label style={{ fontSize: 12, flex: 1, minWidth: 200 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>チャネルシークレット</div>
            <Input value={secret} onChange={(e) => setSecret(e.target.value)} />
          </label>
          <label style={{ fontSize: 12, flex: 1, minWidth: 200 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>x-line-signature</div>
            <Input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="署名を貼る" />
          </label>
          {verified !== null && <Badge variant={verified ? "success" : "danger"}>{verified ? "正当" : "不正 — 処理しない"}</Badge>}
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          <Button size="sm" variant="secondary" onClick={() => setSignature("ZmFrZS1zaWduYXR1cmU=")}>
            偽の署名を入れる
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSignature("")}>
            消す
          </Button>
        </div>

        <Alert variant="danger" title="検証しないと、誰でも偽のイベントを送れます" style={{ marginTop: 10 }}>
          <span style={{ fontSize: 12, lineHeight: 1.8 }}>
            webhook の URL は<strong>公開されています</strong>。署名を確認しないと、
            <strong>「経費申請を承認した」という偽のイベントを外部から送り込めます</strong>。
            <code>verifyLineSignature()</code> の TSDoc も<strong>「必ず検証すること」</strong>と明記しています。
            <br />
            検証は<strong>パース前の生ボディ</strong>で行います。JSON にしてから文字列に戻すと、
            <strong>キーの順序や空白が変わって署名が合わなくなります</strong>。
            <br />
            <strong>実装は <code>timingSafeEqual</code> を使っています</strong>——
            単純な <code>===</code> だと、比較にかかる時間から署名を推測される余地があります。
          </span>
        </Alert>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>② webhook のパース</h2>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {WEBHOOK_SAMPLES.map((s) => (
            <Button key={s.label} size="sm" variant={body === s.body ? "primary" : "secondary"} onClick={() => setBody(s.body)}>
              {s.label}
            </Button>
          ))}
        </div>

        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} style={{ marginBottom: 10, fontFamily: "monospace", fontSize: 11 }} />

        <div style={{ fontSize: 13, marginBottom: 8 }}>
          <b>{events.length}</b> 件のイベント
        </div>

        {events.length > 0 && (
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
                <th style={{ padding: 4 }}>type</th>
                <th style={{ padding: 4 }}>送信元</th>
                <th style={{ padding: 4 }}>中身</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e, i) => {
                // source は必須(? は不要)。message/postback は union なので `in` で絞る
                const src = eventSourceId(e.source);
                const pb = "postback" in e && e.postback !== undefined ? parsePostbackData(e.postback.data) : null;
                const txt = "message" in e && e.message !== undefined ? e.message.text : undefined;
                return (
                  <tr key={i} style={{ borderTop: "1px solid var(--color-border)" }}>
                    <td style={{ padding: 4 }}>
                      <Badge variant="secondary">{e.type}</Badge>
                    </td>
                    <td style={{ padding: 4, ...mono, color: "var(--color-muted)" }}>
                      {e.source.type}
                      <br />
                      {src ?? "—"}
                    </td>
                    <td style={{ padding: 4, ...mono }}>
                      {txt !== undefined && `「${txt}」`}
                      {pb !== null && JSON.stringify(pb)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <Alert variant="warning" title="「壊れたボディ」を押してください" style={{ marginTop: 12 }}>
          <span style={{ fontSize: 12, lineHeight: 1.8 }}>
            <strong>例外を投げずに空配列を返します。</strong>
            webhook の入口で throw すると <strong>500 が返り、LINE がリトライを繰り返します</strong>——
            壊れたボディは何度送っても壊れているので、無限に来ます。
            <br />
            <strong>空配列を返して 200 で受け、ログに残すのが正しい</strong>——
            これが <code>parseLineWebhook()</code> の TSDoc（「解析できなければ空配列」）の意味です。
          </span>
        </Alert>

        <Separator style={{ margin: "14px 0" }} />

        <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 6 }}>
          <code>parsePostbackData()</code> — <strong>クエリ形式</strong>（JSON より短い）
        </div>
        <span style={code}>
          {'parsePostbackData("action=approve&id=42&note=%E7%A2%BA%E8%AA%8D%E6%B8%88")\n→ '}
          {JSON.stringify(parsePostbackData("action=approve&id=42&note=%E7%A2%BA%E8%AA%8D%E6%B8%88"), null, 2)}
        </span>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 8, lineHeight: 1.8 }}>
          <strong>postback の data は 300 文字まで</strong>なので、JSON より<strong>クエリ形式が有利</strong>です。
          URL デコードもします（日本語をそのまま入れられる）。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>③ 宛先の判定</h2>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {RECIPIENTS.map((r) => (
            <Button key={r} size="sm" variant={recipient === r ? "primary" : "secondary"} onClick={() => setRecipient(r)}>
              {r.length > 12 ? `${r.slice(0, 10)}…` : r}
            </Button>
          ))}
        </div>
        <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} style={{ marginBottom: 10 }} />
        <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 13 }}>
          <Badge variant={rt === "unknown" ? "danger" : "success"}>{RECIPIENT_LABEL[rt]}</Badge>
          <span style={{ color: "var(--color-muted)", fontSize: 12 }}>
            <code>isValidLineRecipient()</code> = <b>{String(isValidLineRecipient(recipient))}</b>
          </span>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <strong>先頭 1 文字で種類が決まります</strong>（U = 個人 / C = グループ / R = 複数人トーク）。
          長さも 33 文字と決まっているので、<strong>送る前に弾けます</strong>——
          不正な ID を送ると API がエラーを返しますが、<strong>その前に気づける方が早い</strong>です。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>④ メッセージの組み立て</h2>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {MESSAGE_SAMPLES.map((m, i) => (
            <Button key={m.label} size="sm" variant={msgIndex === i ? "primary" : "secondary"} onClick={() => setMsgIndex(i)}>
              {m.label}
            </Button>
          ))}
        </div>
        <span style={code}>{JSON.stringify(msg, null, 2)}</span>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <strong>LINE の JSON を手で組み立てないための関数です。</strong>
          テンプレートは階層が深く、<code>template.actions[].type</code> を間違えても
          <strong>API に投げるまで気づけません</strong>（型があれば書いた時点で分かります）。
          <br />
          <code>LineAction</code> は <strong>4 種類の union</strong>（message / postback / uri / datetimepicker）。
          <code>postbackAction()</code> は<strong>画面に出さずにデータを送れる</strong>ので、
          「承認」ボタンに <code>action=approve&amp;id=42</code> を仕込めます。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>使い分け</h2>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <tbody>
            {[
              { k: "@platform/notify", v: "単純な通知", note: "「エラーが出ました」を投げるだけ。**これで足りるなら使わない**" },
              { k: "@platform/line", v: "踏み込んだ操作", note: "個別 push・応答・ボタン・webhook 受信" },
            ].map((r) => (
              <tr key={r.k} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: 5, ...mono, width: 150 }}>{r.k}</td>
                <td style={{ padding: 5, width: 110 }}>
                  <Badge variant="outline">{r.v}</Badge>
                </td>
                <td style={{ padding: 5, color: "var(--color-muted)", fontSize: 12 }}>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <code>createLineClient()</code> は <code>fetchImpl</code> を注入できます——
          <strong>テストで実際に LINE へ送らずに済みます</strong>。
          <br />
          <strong>チャネルアクセストークンの管理はアプリ側の責務</strong>です（
          <a href="/secrets" style={{ color: "var(--color-primary)" }}>シークレット管理</a>と組み合わせてください）。
          トークンは<strong>ローテーションされる</strong>ので、環境変数に直書きすると更新のたびに再起動が要ります。
        </p>
      </div>
    </main>
  );
}
