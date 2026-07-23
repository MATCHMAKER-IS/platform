"use client";
/**
 * Webhook 受信のデモ。
 *
 * 実基盤の @platform/webhook は node:crypto を使うためブラウザでは動かないが、
 * **署名の計算そのものはブラウザの Web Crypto で本物を実行している**
 * （HMAC-SHA256。基盤の verifyHmacSignature と同じ計算）。
 * ボディを1文字でも書き換えると検証が落ちることを、実際に確かめられる。
 *
 * 受信側で必ず要るのは次の3つ:
 *   1. 署名の検証   … 送り主が本物か
 *   2. 時刻の確認   … 古い要求の使い回し（リプレイ）でないか
 *   3. 冪等な処理   … 同じイベントが2回届いても1回だけ処理する
 */
import * as React from "react";
import { Button, Badge, Alert, Input, Textarea } from "@platform/ui";

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };
const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" };
const lb: React.CSSProperties = { display: "grid", gap: 4, fontSize: 12, color: "var(--color-muted)" };

const TOLERANCE_SEC = 300; // 5分より古い要求は拒否する

/** HMAC-SHA256 を16進で返す（基盤の verifyHmacSignature と同じ計算）。 */
async function hmacHex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Result = { ok: boolean; label: string; detail: string };

export default function Page() {
  const [secret, setSecret] = React.useState("whsec_demo_shared_secret");
  const [body, setBody] = React.useState('{"id":"evt_1001","type":"invoice.paid","amount":5000}');
  const [signature, setSignature] = React.useState("");
  const [sentAt, setSentAt] = React.useState(() => Math.floor(Date.now() / 1000));
  const [results, setResults] = React.useState<Result[]>([]);
  const [processed, setProcessed] = React.useState<string[]>([]);

  /** 送信側の処理: 署名を作る */
  const sign = async () => {
    const now = Math.floor(Date.now() / 1000);
    setSentAt(now);
    setSignature(`sha256=${await hmacHex(secret, `${now}.${body}`)}`);
    setResults([]);
  };

  /** 受信側の処理: 3つの関門を順に通す */
  const receive = async () => {
    const out: Result[] = [];

    // 1. 署名の検証
    const expected = `sha256=${await hmacHex(secret, `${sentAt}.${body}`)}`;
    const sigOk = signature !== "" && signature === expected;
    out.push({
      ok: sigOk, label: "署名の検証",
      detail: sigOk ? "送り主が持つ秘密鍵で署名されています" : "一致しません。ボディか鍵が書き換わっています（401 を返す）",
    });

    // 2. 時刻の確認（リプレイ防止）
    const ageSec = Math.floor(Date.now() / 1000) - sentAt;
    const freshOk = Math.abs(ageSec) <= TOLERANCE_SEC;
    out.push({
      ok: freshOk, label: "時刻の確認",
      detail: freshOk ? `${ageSec} 秒前の要求（許容 ${TOLERANCE_SEC} 秒）` : `${ageSec} 秒前の要求は古すぎます。過去の通信の使い回しを疑う（400 を返す）`,
    });

    // 3. 冪等な処理（同じイベントは1回だけ）
    let eventId = "";
    try { eventId = String((JSON.parse(body) as { id?: string }).id ?? ""); } catch { eventId = ""; }
    const dup = eventId !== "" && processed.includes(eventId);
    out.push({
      ok: !dup, label: "重複の確認",
      detail: eventId === "" ? "イベント ID が取れません（id は必須）"
        : dup ? `${eventId} は処理済みです。2回目は何もせず 200 を返す` : `${eventId} は初回です`,
    });

    if (sigOk && freshOk && !dup && eventId !== "") setProcessed((p) => [eventId, ...p]);
    setResults(out);
  };

  const allOk = results.length > 0 && results.every((r) => r.ok);

  return (
    <main style={{ maxWidth: 860, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 6 }}>Webhook の受信（署名・リプレイ・冪等）</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16 }}>
        署名は<strong>ブラウザの Web Crypto で実際に計算</strong>しています（HMAC-SHA256）。
        署名を作ったあとにボディを1文字でも変えると、検証が落ちることを確かめられます。
      </p>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>送信側（相手のサービス）</div>
        <label style={{ ...lb, marginBottom: 10 }}>共有シークレット
          <Input value={secret} onChange={(e) => setSecret(e.target.value)} style={{ fontFamily: "monospace" }} />
        </label>
        <label style={{ ...lb, marginBottom: 10 }}>送信するボディ（生の文字列）
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} style={{ width: "100%", fontFamily: "monospace", fontSize: 12.5 }} />
        </label>
        <Button onClick={() => void sign()}>署名して送る</Button>
        {signature !== "" && (
          <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, color: "var(--color-muted)" }}>X-Signature ヘッダ</div>
            <div style={{ ...mono, padding: "8px 10px", borderRadius: 6, background: "var(--color-bg)", border: "1px solid var(--color-border)" }}>{signature}</div>
            <div style={{ fontSize: 12, color: "var(--color-muted)" }}>署名対象は <code>{"{送信時刻}.{ボディ}"}</code>。時刻も含めるのがリプレイ防止の要点です。</div>
          </div>
        )}
      </div>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>受信側（こちらのアプリ）</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <Button onClick={() => void receive()} disabled={signature === ""}>受信して検証</Button>
          <Button variant="secondary" onClick={() => setBody(body.replace("5000", "50000"))} disabled={signature === ""}>
            ボディを改ざんする
          </Button>
          <Button variant="secondary" onClick={() => setSentAt((t) => t - 3600)} disabled={signature === ""}>
            1時間前の要求にする
          </Button>
          <Button variant="secondary" onClick={() => { setProcessed([]); setResults([]); }}>処理済みを消す</Button>
        </div>

        {results.length > 0 && (
          <div style={{ display: "grid", gap: 8 }}>
            {results.map((r) => (
              <div key={r.label} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13 }}>
                <Badge variant={r.ok ? "success" : "danger"}>{r.ok ? "OK" : "NG"}</Badge>
                <div><b>{r.label}</b><div style={{ color: "var(--color-muted)", fontSize: 12.5 }}>{r.detail}</div></div>
              </div>
            ))}
            <div style={{ marginTop: 4 }}>
              <Alert variant={allOk ? "success" : "danger"}>
                {allOk ? "3つの関門を通過したので、この時点で初めて業務処理を実行します。" : "いずれかで弾いたため、業務処理は実行しません。"}
              </Alert>
            </div>
          </div>
        )}

        {processed.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 12.5 }}>
            処理済みイベント: {processed.map((id) => <code key={id} style={{ marginRight: 6 }}>{id}</code>)}
          </div>
        )}
      </div>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>よくある事故</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.9 }}>
          <li><strong>署名を検証していない</strong> — URL さえ分かれば誰でも偽の通知を送れてしまう</li>
          <li><strong>パース後のボディで検証する</strong> — 生の文字列で署名するため、整形すると一致しなくなる</li>
          <li><strong>重複を考えていない</strong> — 相手は応答が無いと再送する。二重計上や二重発送につながる</li>
          <li><strong>処理に時間をかける</strong> — 受信は即 200 を返し、重い処理は <code>@platform/jobs</code> の裏側実行へ回す</li>
        </ul>
      </div>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>実際の受信口の例（Slack）</div>
        <p style={{ fontSize: 12.5, color: "var(--color-muted)", lineHeight: 1.9, margin: 0 }}>
          このデモと同じ考え方で書いた受信口が <code>demos/showcase/src/app/api/slack-events/route.ts</code> にあります。
          Slack の Signing Secret で署名を検証し、<strong>生ボディのまま</strong>照合し、時刻のずれで古い要求を弾きます。
          Slack は <strong>3 秒で接続を切る</strong>ため、重い処理はその場で行わず <code>@platform/jobs</code> のキューへ回します。
          <code>SLACK_SIGNING_SECRET</code> が未設定のときは、<strong>検証できないので何も受け付けません</strong>
          （検証なしで受け付ける方が危険なため）。
        </p>
      </div>

      <Alert variant="info" title="実基盤では">
        <code>@platform/webhook</code> の <code>createWebhookReceiver</code> が、署名検証・冪等ストア・種別ごとの振り分けをまとめて受け持ちます。
        比較には<strong>タイミング安全な比較</strong>を使い、署名の突き合わせ時間から鍵が推測されないようにしています。
      </Alert>
    </main>
  );
}
