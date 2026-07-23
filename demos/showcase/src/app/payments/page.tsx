"use client";
/**
 * 決済のデモ（@platform/stripe / @platform/paypal のフローを再現）。
 *
 * 実際の決済は資格情報が必要でサーバ側でしか動かないため、ここでは
 * **状態の持ち方と、事故が起きやすい箇所**を再現している:
 *   - 注文作成 → 支払確定（キャプチャ）→ 返金（部分返金あり）の状態遷移
 *   - 冪等キー … 通信の再送で二重課金しないための鍵
 *   - 失敗ケース … カード拒否・与信切れ
 *   - Webhook … 「確定した」と判断してよいのは webhook を受けたとき
 */
import * as React from "react";
import { Button, Badge, Alert, Separator, Input, Select } from "@platform/ui";

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };
const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" };
const lb: React.CSSProperties = { display: "grid", gap: 4, fontSize: 12, color: "var(--color-muted)" };

type Provider = "stripe" | "paypal";
type Status = "none" | "created" | "captured" | "partially_refunded" | "refunded" | "failed";

const OPS: Record<Provider, string[]> = {
  stripe: ["createPaymentIntent(amount, currency, { idempotencyKey })", "capture(intentId)", "refund(chargeId, amount?)", "constructWebhookEvent(payload, signature)"],
  paypal: ["createOrder(amount, currency, { requestId })", "captureOrder(orderId)", "refund(captureId, amount?)", "getOrder(orderId)"],
};
const LABEL: Record<Status, string> = {
  none: "未作成", created: "作成済み（未確定）", captured: "支払確定", partially_refunded: "一部返金", refunded: "全額返金", failed: "失敗",
};
const STEPS: { key: Status; label: string }[] = [
  { key: "created", label: "注文作成" }, { key: "captured", label: "支払確定" }, { key: "refunded", label: "返金" },
];

type Ev = { at: string; text: string; kind: "ok" | "ng" | "hook" };

export default function Page() {
  const [provider, setProvider] = React.useState<Provider>("stripe");
  const [status, setStatus] = React.useState<Status>("none");
  const [orderId, setOrderId] = React.useState<string | null>(null);
  const [amount, setAmount] = React.useState(5000);
  const [refunded, setRefunded] = React.useState(0);
  const [refundAmount, setRefundAmount] = React.useState(1000);
  const [idemKey, setIdemKey] = React.useState("order-2026-0001");
  const [failMode, setFailMode] = React.useState("none");
  const [events, setEvents] = React.useState<Ev[]>([]);
  const seen = React.useRef(new Map<string, string>());

  const log = (text: string, kind: Ev["kind"] = "ok") =>
    setEvents((e) => [{ at: new Date().toLocaleTimeString(), text, kind }, ...e].slice(0, 12));

  const create = () => {
    // 冪等キー: 同じ鍵での作成要求は、前回と同じ注文を返す（二重課金の防止）
    const known = seen.current.get(idemKey);
    if (known) { setOrderId(known); setStatus("created"); log(`冪等キー ${idemKey} は作成済み → 既存の ${known} を返す（二重課金しない）`, "hook"); return; }
    if (failMode === "declined") { setStatus("failed"); log("カードが拒否されました（card_declined）", "ng"); return; }
    const id = (provider === "stripe" ? "pi_" : "ORDER-") + Math.random().toString(36).slice(2, 10).toUpperCase();
    seen.current.set(idemKey, id);
    setOrderId(id); setStatus("created"); setRefunded(0);
    log(`注文を作成: ${id} / ¥${amount.toLocaleString()}`);
  };

  const capture = () => {
    if (failMode === "expired") { setStatus("failed"); log("与信の有効期限が切れています（作成から時間が経ちすぎ）", "ng"); return; }
    setStatus("captured");
    log(`支払を確定: ¥${amount.toLocaleString()}`);
    log(`webhook 受信: ${provider === "stripe" ? "payment_intent.succeeded" : "PAYMENT.CAPTURE.COMPLETED"} → ここで初めて出荷・発行に進む`, "hook");
  };

  const refund = () => {
    const amt = Math.min(refundAmount, amount - refunded);
    if (amt <= 0) { log("返金できる残額がありません", "ng"); return; }
    const total = refunded + amt;
    setRefunded(total);
    setStatus(total >= amount ? "refunded" : "partially_refunded");
    log(`返金: ¥${amt.toLocaleString()}（累計 ¥${total.toLocaleString()} / ¥${amount.toLocaleString()}）`);
  };

  const reset = () => { setStatus("none"); setOrderId(null); setRefunded(0); setEvents([]); };
  const order = ["created", "captured", "refunded"];
  const reached = (s: Status) => {
    const cur = status === "partially_refunded" ? "captured" : status;
    return order.indexOf(cur) >= order.indexOf(s);
  };

  return (
    <main style={{ maxWidth: 860, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 6 }}>決済（Stripe / PayPal）</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16 }}>
        注文作成 → 支払確定 → 返金の流れと、二重課金を防ぐ冪等キー・部分返金・失敗ケースを試せます。<Badge variant="warning">sandbox 相当</Badge>
      </p>

      <div style={box}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {(["stripe", "paypal"] as Provider[]).map((p) => (
            <Button key={p} size="sm" variant={provider === p ? "primary" : "secondary"}
              onClick={() => { setProvider(p); reset(); }}>{p}</Button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          {STEPS.map((st, i) => (
            <React.Fragment key={st.key}>
              <div style={{ textAlign: "center", flex: 1 }}>
                <div style={{ width: 32, height: 32, borderRadius: 999, margin: "0 auto 6px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, background: reached(st.key) ? "var(--color-primary)" : "var(--color-bg)", color: reached(st.key) ? "var(--color-primary-fg)" : "var(--color-muted)", border: "1px solid var(--color-border)" }}>{i + 1}</div>
                <div style={{ fontSize: 12, color: reached(st.key) ? "var(--color-fg)" : "var(--color-muted)" }}>{st.label}</div>
              </div>
              {i < STEPS.length - 1 && <div style={{ height: 2, flex: 1, background: reached(STEPS[i + 1]!.key) ? "var(--color-primary)" : "var(--color-border)" }} />}
            </React.Fragment>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
          <label style={lb}>金額
            <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} disabled={status !== "none"} style={{ width: 120 }} />
          </label>
          <label style={lb}>冪等キー
            <Input value={idemKey} onChange={(e) => setIdemKey(e.target.value)} style={{ width: 190 }} />
          </label>
          <label style={lb}>失敗させる
            <Select value={failMode} onChange={(e) => setFailMode(e.target.value)}
              options={[{ label: "しない", value: "none" }, { label: "カード拒否", value: "declined" }, { label: "与信切れ", value: "expired" }]} />
          </label>
        </div>

        {orderId && (
          <div style={{ ...mono, padding: 10, background: "var(--color-bg)", borderRadius: "var(--radius)", border: "1px solid var(--color-border)", marginBottom: 12 }}>
            {provider === "stripe" ? "payment_intent" : "order_id"}: {orderId} / ¥{amount.toLocaleString()}
            {refunded > 0 && <> / 返金済 ¥{refunded.toLocaleString()}</>} / status: <strong>{LABEL[status]}</strong>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Button size="sm" onClick={create} disabled={status !== "none" && status !== "failed"}>注文作成</Button>
          <Button size="sm" onClick={capture} disabled={status !== "created"}>支払確定（キャプチャ）</Button>
          <label style={lb}>返金額
            <Input type="number" value={refundAmount} onChange={(e) => setRefundAmount(Number(e.target.value) || 0)} style={{ width: 110 }} />
          </label>
          <Button size="sm" variant="secondary" onClick={refund} disabled={status !== "captured" && status !== "partially_refunded"}>返金する</Button>
          <Button size="sm" variant="secondary" onClick={reset}>リセット</Button>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          同じ冪等キーのまま「注文作成」を2回押すと、新しい注文は作られません。通信が不安定で再送が起きても、二重課金にならない仕組みです。
        </p>
      </div>

      {events.length > 0 && (
        <div style={box}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>イベント履歴</div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
            {events.map((e, i) => (
              <li key={i} style={{ fontSize: 12.5, display: "flex", gap: 8 }}>
                <span style={{ ...mono, color: "var(--color-muted)" }}>{e.at}</span>
                <span style={{ color: e.kind === "ng" ? "var(--color-danger, #c00)" : e.kind === "hook" ? "var(--color-primary)" : "var(--color-fg)" }}>{e.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{provider} の主な操作</div>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
          {OPS[provider].map((o) => (<li key={o}><code style={{ ...mono, color: "var(--color-primary)" }}>{o}</code></li>))}
        </ul>
      </div>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>間違えやすい点</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.9 }}>
          <li><strong>画面の戻りで完了と判断する</strong> — 利用者がタブを閉じると取りこぼす。確定は <strong>webhook</strong> で判断する</li>
          <li><strong>冪等キーを付けない</strong> — 再送やダブルクリックがそのまま二重課金になる</li>
          <li><strong>金額を小数で扱う</strong> — 通貨の最小単位（円なら 1）を整数で扱う。<code>@platform/currency</code> の担当</li>
          <li><strong>返金の累計を持たない</strong> — 部分返金を繰り返すと、返金額が元の金額を超えうる</li>
        </ul>
      </div>

      <Separator style={{ margin: "8px 0 16px" }} />
      <Alert variant="info" title="実基盤では">
        <code>@platform/stripe</code> は公式 SDK をラップ（Webhook の署名検証つき）、<code>@platform/paypal</code> は Orders v2 を型付きで扱い、
        client_id / secret からトークンを自動取得・キャッシュします。live / sandbox の切り替えは <code>@platform/env</code> の設定で行います。
      </Alert>
    </main>
  );
}
