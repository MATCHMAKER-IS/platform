"use client";
/**
 * 画面で例外が起きたときの受け皿。
 *
 * 用意しないと**既定の白い画面**が出て、利用者は何が起きたか分からない。
 * 開発中は原因が見えるが、本番では見えないため「壊れた」としか伝わらない。
 *
 * ここで示すのは 3 つ:
 *   - 何が起きたか（この画面だけの問題か、全体の問題か）
 *   - すぐ試せること（やり直す）
 *   - 直す人に伝えること（識別子）
 *
 * 例外の中身は利用者に見せない（内部の作りが漏れる）。
 * 開発中だけ、原因を追える形で出す。
 */
import * as React from "react";
import { Button } from "@platform/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // 実運用では @platform/observability へ送る。
    // 利用者に見せずに、直す人が原因を追えるようにするため
    console.error(error);
  }, [error]);

  const isDev = process.env.NODE_ENV !== "production";

  return (
    <main style={{ maxWidth: 560, margin: "4rem auto", padding: "0 1rem" }}>
      <div style={{ fontSize: 40, marginBottom: 12, textAlign: "center" }}>⚠️</div>
      <h1 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 10, textAlign: "center" }}>
        この画面を表示できませんでした
      </h1>
      <p style={{ fontSize: 13.5, color: "var(--color-muted)", lineHeight: 2, textAlign: "center", margin: "0 0 20px" }}>
        <strong>この画面だけの問題</strong>です。他の画面は開けます。
      </p>

      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 24 }}>
        <Button onClick={reset}>もう一度試す</Button>
        <Button variant="secondary" onClick={() => { window.location.href = "/"; }}>
          デモの一覧へ
        </Button>
      </div>

      <div
        style={{
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius)",
          padding: 14,
          background: "var(--color-surface)",
        }}
      >
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>直す人に伝えること</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.9, color: "var(--color-muted)" }}>
          <li>開いていた画面の URL</li>
          <li>直前にした操作</li>
          {error.digest && (
            <li>
              識別子: <code style={{ fontFamily: "var(--font-mono)" }}>{error.digest}</code>
              （記録と突き合わせるのに使います）
            </li>
          )}
        </ul>

        {isDev && (
          <details style={{ marginTop: 12 }}>
            <summary style={{ fontSize: 12, cursor: "pointer", color: "var(--color-muted)" }}>
              開発中のみ: 例外の内容を見る
            </summary>
            <pre
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                lineHeight: 1.7,
                margin: "8px 0 0",
                padding: 10,
                borderRadius: 6,
                background: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                maxHeight: 240,
                overflow: "auto",
              }}
            >
              {error.message}
              {error.stack ? `\n\n${error.stack}` : ""}
            </pre>
            <p style={{ fontSize: 11, color: "var(--color-muted)", margin: "8px 0 0", lineHeight: 1.8 }}>
              <strong>本番では出しません。</strong>例外の内容には、内部の作りや値が含まれることがあります。
            </p>
          </details>
        )}
      </div>
    </main>
  );
}
