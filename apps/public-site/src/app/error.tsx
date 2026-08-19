"use client";
/**
 * 画面で例外が起きたときの受け皿。
 *
 * 用意しないと**既定の白い画面**が出て、「壊れた」としか伝わらない。
 * 例外の中身は利用者に見せない（内部の作りや値が漏れる）。
 * 直す人が追えるよう、識別子（digest）だけを示す。
 */
import { useEffect } from "react";
import { Button } from "@platform/ui";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // 実運用では @platform/observability へ送る。digest でサーバの記録と突き合わせる
    console.error("画面エラー", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <main style={{ maxWidth: 520, margin: "4rem auto", padding: "0 1rem", textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
      <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 10 }}>この画面を表示できませんでした</h1>
      <p style={{ fontSize: 13.5, color: "var(--color-muted)", lineHeight: 2, margin: "0 0 20px" }}>
        <strong>この画面だけの問題</strong>です。他の画面は開けます。
        <br />
        続くようなら、下の識別子を添えて情報システム部門へお知らせください。
      </p>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }}>
        <Button onClick={reset}>もう一度試す</Button>
        <Button variant="secondary" onClick={() => { window.location.href = "/"; }}>最初の画面へ</Button>
      </div>
      {error.digest && (
        <p style={{ fontSize: 11.5, color: "var(--color-muted)" }}>
          識別子: <code style={{ fontFamily: "var(--font-mono)" }}>{error.digest}</code>
        </p>
      )}
    </main>
  );
}
