"use client";
import * as React from "react";
import { UsesPackages } from "../../components/uses-packages";
import { GraphDemo } from "./graph-demo";

export default function Page() {
  return (
    <main style={{ maxWidth: 900, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>Microsoft 365 連携</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16 }}>
        Entra ID の OAuth と Microsoft Graph。メール送信・予定作成・空き時間の照会・OneDrive への保存。
      </p>
      <GraphDemo />
      <UsesPackages
        packages={["microsoft"]}
        imports={{ microsoft: ["createMicrosoftGraphClient", "createMicrosoftTokenManager"] }}
        snippet={`// トークンの更新は基盤が持つ（期限切れなら自動で取り直す）
const graph = createMicrosoftGraphClient(createMicrosoftAuthedFetch(tokens));

// **available を必ず見る**。権限が無い相手は予定が空で返る（空きではない）
const schedules = await graph.getSchedule({ emails, start, end });
const bookable = schedules.filter((s) => s.available && s.busy.length === 0);`}
      />
    </main>
  );
}
