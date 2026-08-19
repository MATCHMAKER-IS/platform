"use client";
/**
 * Webhook 受信のデモ。**サーバ側で `@platform/webhook` をそのまま動かす**。
 *
 * 以前はこの画面が署名計算をブラウザで再現していた(基盤が `node:crypto` を使い
 * ブラウザで動かないため)。だが**基盤を通らないデモは、基盤が壊れても気づけない**。
 * `/api/webhook-demo` を経由して本物を叩く形にした。
 *
 * 受信側で必ず要るのは次の 3 つ。**すべて `createWebhookReceiver` が担う**:
 *   1. 署名の検証   … 送り主が本物か
 *   2. 冪等な処理   … 同じイベントが 2 回届いても 1 回だけ処理する
 *   3. 型別の振り分け … イベントの種類ごとに処理を分ける
 */
import * as React from "react";
import { Button, Badge, Alert, Input, Textarea } from "@platform/ui";
import { UsesPackages } from "../../components/uses-packages";

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };

/** サーバが返す判定。 */
type Status = "processed" | "duplicate" | "invalid_signature" | "unhandled";

interface ApiResponse {
  result: { status: Status; type?: string; eventId?: string };
  processed: { at: string; type: string; detail: string }[];
}

const STATUS_LABEL: Record<Status, { label: string; variant: "success" | "warning" | "danger" | "secondary"; detail: string }> = {
  processed: { label: "処理した", variant: "success", detail: "署名が正しく、初めて受け取ったイベントなので処理しました" },
  duplicate: { label: "重複", variant: "warning", detail: "**同じ id を既に処理済み**。もう一度処理すると二重計上になるので何もしません" },
  invalid_signature: { label: "署名が不正", variant: "danger", detail: "送り主の秘密鍵で署名されていません。**401 を返して捨てます**" },
  unhandled: { label: "未対応の種別", variant: "secondary", detail: "この種別のハンドラが登録されていません(200 を返して受領だけする)" },
};

export default function Page() {
  const [body, setBody] = React.useState('{"id":"evt_1001","type":"payment.succeeded","data":{"amount":5000}}');
  const [signature, setSignature] = React.useState("");
  const [res, setRes] = React.useState<ApiResponse | null>(null);
  const [busy, setBusy] = React.useState(false);

  /** 送信側の処理: サーバに正しい署名を作ってもらう(実際は送り主が作る)。 */
  const sign = async () => {
    setBusy(true);
    const r = await fetch(`/api/webhook-demo?payload=${encodeURIComponent(body)}`);
    const j = (await r.json()) as { signature: string };
    setSignature(j.signature);
    setRes(null);
    setBusy(false);
  };

  /** 受信側の処理: 本物の receiver に通す。 */
  const send = async () => {
    setBusy(true);
    const r = await fetch("/api/webhook-demo", {
      method: "POST",
      headers: { "content-type": "application/json", "x-signature": signature },
      body,
    });
    setRes((await r.json()) as ApiResponse);
    setBusy(false);
  };

  const status = res?.result.status;

  return (
    <main style={{ maxWidth: 900, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>Webhook 受信</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16 }}>
        署名の検証・重複の排除・種別ごとの処理を、<code>createWebhookReceiver</code> がまとめて行います。
      </p>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>1. 送り主がイベントを署名する</div>
        <label style={{ fontSize: 12 }}>
          <div style={{ color: "var(--color-muted)", marginBottom: 4 }}>
            送るイベント（<code>type</code> は <code>payment.succeeded</code> / <code>user.created</code> に対応）
          </div>
          <Textarea value={body} onChange={(e) => { setBody(e.target.value); setSignature(""); setRes(null); }} rows={3} style={{ fontFamily: "var(--font-mono)", fontSize: 12 }} />
        </label>
        <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
          <Button onClick={() => void sign()} disabled={busy}>署名する</Button>
          {signature !== "" && <code style={{ fontSize: 11, color: "var(--color-muted)" }}>x-signature: {signature.slice(0, 24)}…</code>}
        </div>
      </div>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>2. 受信側に送る</div>
        <label style={{ fontSize: 12 }}>
          <div style={{ color: "var(--color-muted)", marginBottom: 4 }}>署名（<strong>書き換えると検証に落ちます</strong>）</div>
          <Input value={signature} onChange={(e) => setSignature(e.target.value)} style={{ fontFamily: "var(--font-mono)", fontSize: 12 }} />
        </label>
        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <Button onClick={() => void send()} disabled={busy || signature === ""}>送信</Button>
          <Button onClick={() => void send()} disabled={busy || signature === ""}>もう一度送る（重複を試す）</Button>
        </div>
      </div>

      {res && status !== undefined && (
        <div style={box}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <Badge variant={STATUS_LABEL[status].variant}>{STATUS_LABEL[status].label}</Badge>
            {res.result.type !== undefined && <code style={{ fontSize: 12 }}>{res.result.type}</code>}
          </div>
          <p style={{ fontSize: 13, color: "var(--color-muted)", margin: 0 }}>{STATUS_LABEL[status].detail}</p>

          {res.processed.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 14, marginBottom: 6 }}>実際に処理した内容</div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                {res.processed.map((p) => (
                  <li key={`${p.at}-${p.type}`} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 6, background: "var(--color-bg)", border: "1px solid var(--color-border)" }}>
                    <code style={{ marginRight: 8 }}>{p.type}</code>{p.detail}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <Alert variant="info" title="重複は必ず起きる">
        Webhook は<strong>同じイベントが 2 回以上届く前提</strong>で作ります（送り主が応答を受け取れないと再送するため）。
        <code>eventId</code> で冪等にしておかないと、入金が二重計上されます。
        署名の検証は<strong>生のボディ</strong>に対して行うこと（JSON をパースして戻すと、キーの順序が変わって一致しなくなります）。
      </Alert>

      <UsesPackages
        packages={["webhook"]}
        imports={{ webhook: ["createWebhookReceiver", "createMemoryWebhookStore", "verifyHmacSignature"] }}
        snippet={`// 署名検証・冪等・振り分けを 1 つで担う
const receiver = createWebhookReceiver({
  secret: env.WEBHOOK_SECRET,
  store: createMemoryWebhookStore(),   // 本番は DB/Redis（再起動で消えては困る）
  parse: (raw) => JSON.parse(raw),
  eventId: (e) => e.id,                // **冪等キー**。これが無いと二重計上する
  eventType: (e) => e.type,
}).on("payment.succeeded", async (e) => { await recordPayment(e); });

// **生のボディで検証する**（パースして戻すと署名が合わない）
const result = await receiver.handle(await req.text(), req.headers.get("x-signature") ?? "");`}
      />
    </main>
  );
}
