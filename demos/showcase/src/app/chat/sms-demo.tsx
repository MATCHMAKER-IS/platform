"use client";
/**
 * SMS 送信のデモ（@platform/sms 相当の挙動をローカルで再現）。
 * 宛先と本文を入れて送信（モックTransport）。実基盤は Twilio 等を差し替えても呼び出しは同じ。
 */
import * as React from "react";
import { Button, Badge, Alert, Input, Textarea } from "@platform/ui";

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };
type Sent = { to: string; body: string; at: number; status: "queued" | "sent" | "failed" };
const MAX = 70;

export function SmsDemo() {
  const [to, setTo] = React.useState("090-1234-5678");
  const [body, setBody] = React.useState("【サンプル】ワンタイムコードは 123456 です。");
  const [log, setLog] = React.useState<Sent[]>([]);

  const validPhone = /^0\d{1,3}-?\d{2,4}-?\d{3,4}$/.test(to.replace(/\s/g, ""));
  const send = () => {
    const item: Sent = { to, body, at: Date.now(), status: "queued" };
    setLog((l) => [item, ...l].slice(0, 10));
    setTimeout(() => setLog((l) => l.map((x) => (x.at === item.at ? { ...x, status: Math.random() > 0.15 ? "sent" : "failed" } : x))), 800);
  };

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 16 }}>SMS 送信</h1>
      <div style={box}>
        <div style={{ display: "grid", gap: 10 }}>
          <label style={{ fontSize: 12 }}><div style={{ color: "var(--color-muted)", marginBottom: 4 }}>宛先（携帯番号）</div>
            <Input value={to} onChange={(e) => setTo(e.target.value)} />
            {!validPhone && to !== "" && <div style={{ fontSize: 11, color: "var(--color-danger)", marginTop: 4 }}>電話番号の形式が正しくないようです</div>}</label>
          <label style={{ fontSize: 12 }}><div style={{ color: "var(--color-muted)", marginBottom: 4 }}>本文（{body.length}/{MAX}）</div>
            <Textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, MAX))} rows={3} /></label>
        </div>
        <div style={{ marginTop: 12 }}><Button onClick={send} disabled={!validPhone || body.length === 0}>送信</Button></div>
      </div>
      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>送信ログ</div>
        {log.length === 0 ? (<div style={{ fontSize: 12, color: "var(--color-muted)" }}>送信するとここに履歴が出ます（約15%で失敗を模擬）。</div>) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {log.map((s) => (<li key={s.at} style={{ padding: "8px 10px", borderRadius: 6, background: "var(--color-bg)", border: "1px solid var(--color-border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <Badge variant={s.status === "sent" ? "success" : s.status === "failed" ? "danger" : "secondary"}>{s.status === "queued" ? "送信中" : s.status === "sent" ? "送信済" : "失敗"}</Badge>
                <span style={{ fontFamily: "monospace", fontSize: 12 }}>{s.to}</span>
                <span style={{ fontSize: 11, color: "var(--color-muted)", marginLeft: "auto" }}>{new Date(s.at).toLocaleTimeString("ja-JP")}</span></div>
              <div style={{ fontSize: 12, color: "var(--color-muted)" }}>{s.body}</div></li>))}
          </ul>)}
      </div>
      <Alert variant="info" title="実基盤では"><code>@platform/sms</code> は Adapter パターンで、送信基盤（Twilio 等）を差し替えても呼び出し側は <code>sendSms()</code> のまま。<code>mail</code> と同じ構造です。</Alert>
    </>
  );
}
