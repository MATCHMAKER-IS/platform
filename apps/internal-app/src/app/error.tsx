"use client";
/**
 * ルートセグメントのエラーバウンダリ。サーバ/クライアントの未処理例外を捕捉し、
 * 制御されたフォールバック UI を表示する。error.digest はサーバ側ログの相関に使える。
 */
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // クライアント側の可観測性へ送る(実運用では Sentry 等)。digest でサーバログと突合。
    console.error("画面エラー", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div style={{ padding: "3rem", maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
      <h2 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>問題が発生しました</h2>
      <p style={{ color: "#666", marginBottom: "1.5rem" }}>
        一時的なエラーの可能性があります。時間をおいて再度お試しください。
      </p>
      {error.digest && (
        <p style={{ color: "#999", fontSize: "0.8rem", marginBottom: "1.5rem" }}>
          お問い合わせの際はこの ID をお伝えください: <code>{error.digest}</code>
        </p>
      )}
      <button onClick={reset} style={{ padding: "0.5rem 1.5rem", borderRadius: 6, border: "1px solid #ccc", cursor: "pointer" }}>
        再試行
      </button>
    </div>
  );
}
