"use client";
import * as React from "react";
import { UsesPackages } from "../../components/uses-packages";
import { PayPalDemo } from "./paypal-demo";

export default function Page() {
  return (
    <main style={{ maxWidth: 900, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>PayPal 決済</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16 }}>
        注文の作成 → 利用者の承認 → 入金の確定。<strong>承認と入金は別</strong>であることを実際に確かめられます。
      </p>
      <PayPalDemo />
      <UsesPackages
        packages={["paypal"]}
        imports={{ paypal: ["createPayPalClient"] }}
        snippet={`const paypal = createPayPalClient({
  clientId: env.PAYPAL_CLIENT_ID,
  clientSecret: env.PAYPAL_CLIENT_SECRET,
  environment: "sandbox",   // 本番は省略（既定 live）
});

// 1. 注文を作る（承認用リンクが返る）
const order = await paypal.createOrder({ intent: "CAPTURE", purchase_units: [...] });

// 2. 利用者が承認したら **captureOrder で確定する**（呼ばないと入金されない）
await paypal.captureOrder(orderId);`}
      />
    </main>
  );
}
