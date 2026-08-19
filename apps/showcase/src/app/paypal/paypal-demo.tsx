"use client";
/**
 * PayPal 決済のデモ。**`@platform/paypal` の本物のクライアントを動かす**。
 *
 * 実 API には認証情報が要るので、`fetchImpl` に**応答を模した関数**を注入する。
 * クライアント側のロジック（トークンの取得と使い回し・要求の組み立て）は本物が動く。
 *
 * 見せたいのは **「承認」と「入金」は別**ということ。
 * 利用者が PayPal の画面で承認しても、`captureOrder` を呼ぶまで**お金は動かない**。
 * ここを忘れると「注文は入っているのに入金されない」ことになる。
 */
import * as React from "react";
import { Button, Badge, Alert, Input } from "@platform/ui";
import { createPayPalClient } from "@platform/paypal";

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };

/** 注文の状態。**PayPal が返す値と同じ語**を使う。 */
type OrderState = "none" | "CREATED" | "APPROVED" | "COMPLETED" | "REFUNDED";

interface Step { at: string; label: string; detail: string; ok: boolean }

/**
 * PayPal API の応答を模した fetch。
 *
 * **トークンの取得も含めて模す**(クライアントは毎回トークンを取りに行く)。
 * 状態は呼び出し側が持ち、`captureOrder` の前後で応答を変える。
 */
function createFakeFetch(getState: () => OrderState, log: (path: string) => void): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    const path = url.replace(/^https:\/\/[^/]+/, "");
    log(path);

    if (path.includes("/oauth2/token")) {
      return Response.json({ access_token: "A21AA-demo-token", expires_in: 32400 });
    }
    if (path.includes("/capture")) {
      return Response.json({ id: "ORDER-DEMO-1", status: "COMPLETED", purchase_units: [{ payments: { captures: [{ id: "CAPTURE-DEMO-1" }] } }] });
    }
    if (path.includes("/refund")) {
      return Response.json({ id: "REFUND-DEMO-1", status: "COMPLETED" });
    }
    if (path.includes("/orders")) {
      const state = getState();
      return Response.json({
        id: "ORDER-DEMO-1",
        status: state === "none" ? "CREATED" : state,
        links: [{ rel: "approve", href: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-DEMO-1" }],
      });
    }
    return Response.json({ error: "not found" }, { status: 404 });
  }) as typeof fetch;
}

export function PayPalDemo() {
  const [amount, setAmount] = React.useState("3500");
  const [state, setState] = React.useState<OrderState>("none");
  const [steps, setSteps] = React.useState<Step[]>([]);
  const [busy, setBusy] = React.useState(false);
  const stateRef = React.useRef<OrderState>("none");
  stateRef.current = state;

  const push = (label: string, detail: string, ok = true) =>
    setSteps((s) => [...s, { at: new Date().toLocaleTimeString("ja-JP"), label, detail, ok }]);

  /** **本物のクライアント。** 差し替えているのは fetch だけ。 */
  const client = React.useMemo(
    () => createPayPalClient({
      clientId: "demo-client-id",
      clientSecret: "demo-secret",
      environment: "sandbox",
      fetchImpl: createFakeFetch(() => stateRef.current, (p) => push("API", `POST ${p}`)),
    }),
    [],
  );

  const createOrder = async () => {
    setBusy(true); setSteps([]);
    const res = await client.createOrder({
      intent: "CAPTURE",
      purchase_units: [{ amount: { currency_code: "JPY", value: amount } }],
    });
    if (res.ok) {
      setState("CREATED");
      push("注文を作成", `${res.value.id} / ${res.value.status}。承認用のリンクが返ります`);
    } else {
      push("注文の作成に失敗", res.error.message, false);
    }
    setBusy(false);
  };

  const approve = () => {
    setState("APPROVED");
    push("利用者が承認", "PayPal の画面で承認しました。**この時点ではまだ入金されていません**".replace(/\*\*/g, ""));
  };

  const capture = async () => {
    setBusy(true);
    const res = await client.captureOrder("ORDER-DEMO-1");
    if (res.ok) {
      setState("COMPLETED");
      push("入金を確定", `${amount} 円を受け取りました（captureOrder）`);
    } else {
      push("確定に失敗", res.error.message, false);
    }
    setBusy(false);
  };

  const refund = async () => {
    setBusy(true);
    const res = await client.refundCapture("CAPTURE-DEMO-1");
    if (res.ok) {
      setState("REFUNDED");
      push("返金", "全額を返金しました（refundCapture）");
    } else {
      push("返金に失敗", res.error.message, false);
    }
    setBusy(false);
  };

  const STATE_LABEL: Record<OrderState, { text: string; variant: "secondary" | "warning" | "success" | "danger" }> = {
    none: { text: "未作成", variant: "secondary" },
    CREATED: { text: "作成済み（未承認）", variant: "secondary" },
    APPROVED: { text: "承認済み（未入金）", variant: "warning" },
    COMPLETED: { text: "入金済み", variant: "success" },
    REFUNDED: { text: "返金済み", variant: "danger" },
  };

  return (
    <>
      <div style={box}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Badge variant={STATE_LABEL[state].variant}>{STATE_LABEL[state].text}</Badge>
          {state === "APPROVED" && (
            <span style={{ fontSize: 12.5, color: "var(--color-warning)" }}>
              承認されただけです。<strong>captureOrder を呼ぶまでお金は動きません</strong>
            </span>
          )}
        </div>
        <label style={{ fontSize: 12 }}>
          <div style={{ color: "var(--color-muted)", marginBottom: 4 }}>金額（円）</div>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 140 }} disabled={state !== "none"} />
        </label>
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button onClick={() => void createOrder()} disabled={busy || state !== "none"}>1. 注文を作る</Button>
          <Button onClick={approve} disabled={busy || state !== "CREATED"}>2. 利用者が承認</Button>
          <Button onClick={() => void capture()} disabled={busy || state !== "APPROVED"}>3. 入金を確定</Button>
          <Button onClick={() => void refund()} disabled={busy || state !== "COMPLETED"}>返金</Button>
          <Button onClick={() => { setState("none"); setSteps([]); }} disabled={busy}>最初から</Button>
        </div>
      </div>

      {steps.length > 0 && (
        <div style={box}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>流れ</div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {steps.map((s, i) => (
              <li key={`${s.at}-${i}`} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 12 }}>
                <Badge variant={s.ok ? (s.label === "API" ? "secondary" : "success") : "danger"}>{s.label}</Badge>
                <span style={{ color: "var(--color-muted)", fontFamily: s.label === "API" ? "monospace" : "inherit" }}>{s.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Alert variant="info" title="承認と入金は別">
        利用者が PayPal の画面で承認しても、<strong><code>captureOrder</code> を呼ぶまでお金は動きません</strong>。
        ここを忘れると「注文は入っているのに入金されない」ことになります。
        承認の通知は Webhook で受け取り、そこで確定するのが定石です（<code>/webhook</code> のデモ参照）。
        トークンの取得と使い回しは基盤が行うので、呼び出し側は意識しません。
      </Alert>
    </>
  );
}
