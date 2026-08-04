"use client";
/**
 * SMS 送信のデモ。**`@platform/sms` の実装をそのまま動かす**。
 *
 * 以前はこの画面が「@platform/sms 相当の挙動をローカルで再現」しており、
 * 電話番号の検証も文字数計算も自前だった。**基盤を使わないデモは、基盤が壊れても
 * 気づけない**うえ、利用者に間違った使い方を見せることになる。
 *
 * Transport にメモリ実装を差し込んでいる。**呼び出し方は Twilio でも同じ**で、
 * それが Adapter パターンの要点。
 */
import * as React from "react";
import { Button, Badge, Alert, Input, Textarea } from "@platform/ui";
import { createSms, createMemoryTransport, smsInfo, type SmsMessage } from "@platform/sms/browser";
import { toE164, isValidJpPhone } from "@platform/phone";

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };

/** 送信結果の表示用。 */
type Sent = { to: string; body: string; at: number; ok: boolean; error?: string };

export function SmsDemo() {
  const [to, setTo] = React.useState("090-1234-5678");
  const [body, setBody] = React.useState("【サンプル】ワンタイムコードは 123456 です。");
  const [log, setLog] = React.useState<Sent[]>([]);
  const [busy, setBusy] = React.useState(false);

  // **Transport を差し替えれば Twilio になる。** 呼び出し側(sendSms)は変わらない
  const sms = React.useMemo(() => createSms({
    transport: createMemoryTransport(),
    defaultFrom: "+815000000000",
  }), []);

  // 文字数・分割数は基盤が計算する。**日本語は 70 文字で 1 通**(UCS-2)、
  // 英数字だけなら 160 文字。決め打ちでは料金を見誤る
  const info = smsInfo(body);
  const e164 = toE164(to);
  const validPhone = isValidJpPhone(to);

  const send = async () => {
    if (!e164) return;
    setBusy(true);
    const message: SmsMessage = { to: e164, body };
    const res = await sms.sendSms(message);
    setLog((l) => [{
      to: e164,
      body,
      at: Date.now(),
      ok: res.ok,
      ...(res.ok ? {} : { error: res.error.message }),
    }, ...l].slice(0, 10));
    setBusy(false);
  };

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 16 }}>SMS 送信</h1>
      <div style={box}>
        <div style={{ display: "grid", gap: 10 }}>
          <label style={{ fontSize: 12 }}>
            <div style={{ color: "var(--color-muted)", marginBottom: 4 }}>宛先（携帯番号）</div>
            <Input value={to} onChange={(e) => setTo(e.target.value)} />
            {to !== "" && (
              validPhone
                ? <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 4 }}>E.164: <code>{e164}</code>（送信時はこの形に正規化されます）</div>
                : <div style={{ fontSize: 11, color: "var(--color-danger)", marginTop: 4 }}>日本の電話番号として解釈できません</div>
            )}
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ color: "var(--color-muted)", marginBottom: 4 }}>
              本文（{info.length} 文字 / {info.segments} 通 / {info.encoding}）
            </div>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
            <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 4 }}>
              日本語が混ざると UCS-2 になり <strong>70 文字で 1 通</strong>。英数字だけなら 160 文字です（料金は通数で決まります）。
            </div>
          </label>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={() => void send()} disabled={!validPhone || body.length === 0 || busy}>
            {busy ? "送信中…" : "送信"}
          </Button>
        </div>
      </div>
      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>送信ログ</div>
        {log.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--color-muted)" }}>送信するとここに履歴が出ます（メモリ Transport なので実際には飛びません）。</div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {log.map((s) => (
              <li key={s.at} style={{ padding: "8px 10px", borderRadius: 6, background: "var(--color-bg)", border: "1px solid var(--color-border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <Badge variant={s.ok ? "success" : "danger"}>{s.ok ? "送信済" : "失敗"}</Badge>
                  <span style={{ fontFamily: "monospace", fontSize: 12 }}>{s.to}</span>
                  <span style={{ fontSize: 11, color: "var(--color-muted)", marginLeft: "auto" }}>{new Date(s.at).toLocaleTimeString("ja-JP")}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--color-muted)" }}>{s.body}</div>
                {s.error !== undefined && <div style={{ fontSize: 12, color: "var(--color-danger)", marginTop: 3 }}>{s.error}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <Alert variant="info" title="この画面は基盤をそのまま動かしています">
        <code>createSms({"{ transport: createMemoryTransport() }"})</code> で組み立てています。
        <strong>Twilio に差し替えても <code>sendSms()</code> の呼び方は変わりません</strong>（Adapter パターン）。
        失敗は例外ではなく <code>Result</code> で返るので、送信ログに理由が出ます。
      </Alert>
    </>
  );
}
