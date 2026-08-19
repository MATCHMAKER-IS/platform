"use client";
/** 月次配信の宛先管理デモ(RecipientManager)。 */
import { useState } from "react";
import { RecipientManager, type Recipient } from "@platform/ui";

export function RecipientsDemo() {
  const [saved, setSaved] = useState<Recipient[] | null>(null);
  return (
    <>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>月次配信の宛先管理</h1>
      <p style={{ color: "var(--color-muted)", margin: ".5rem 0 1.5rem", fontSize: ".9rem" }}>
月次レポートの送り先を追加・削除、CSVで入出力できます。保存は実運用では repository / API に永続化します。
      </p>
      <RecipientManager
        initial={[
          { id: "1", name: "経理部", email: "keiri@example.co.jp", role: "finance", channels: ["email"] },
          { id: "2", name: "田中部長", email: "tanaka@example.co.jp", role: "manager", channels: ["email"] },
        ]}
        onSave={(list) => setSaved(list)}
      />
      {saved && <p style={{ marginTop: "1rem", color: "var(--color-primary)" }}>保存しました({saved.length} 件)。</p>}
      <p style={{ marginTop: "1.5rem" }}><a href="/">← 戻る</a></p>
    </>
  );
}
