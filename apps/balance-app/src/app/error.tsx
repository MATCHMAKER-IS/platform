"use client";
/**
 * 例外時の受け皿。既定の白い画面を出さない。
 */
import { useEffect } from "react";
import { Button } from "@platform/ui";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("画面エラー", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <main style={{ maxWidth: 520, margin: "4rem auto", padding: "0 1rem", textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
      <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 10 }}>残高を表示できませんでした</h1>
      <p style={{ fontSize: 13.5, color: "var(--color-muted)", lineHeight: 2, margin: "0 0 20px" }}>
        freee への接続か、集計の途中で問題が起きました。
        <br />
        続くようなら、下の識別子を添えて情報システム部門へお知らせください。
      </p>
      <Button onClick={reset}>もう一度試す</Button>
      {error.digest && (
        <p style={{ fontSize: 11.5, color: "var(--color-muted)", marginTop: 16 }}>
          識別子: <code style={{ fontFamily: "monospace" }}>{error.digest}</code>
        </p>
      )}
    </main>
  );
}
