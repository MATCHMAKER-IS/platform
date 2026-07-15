"use client";
/**
 * ルートレイアウト自体が壊れた場合の最終フォールバック。
 * 共有テンプレート(@platform/status-page)の HTML を使い、見た目を全画面で統一する。
 */
import { renderErrorPage } from "@platform/status-page";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const html = renderErrorPage({
    brand: "社内システム",
    referenceId: error.digest,
  });
  // global-error は html/body ごと差し替えるため、テンプレートの body 内容を流し込む
  const bodyInner = html.slice(html.indexOf("<body>") + 6, html.indexOf("</body>"));
  const headStyle = html.slice(html.indexOf("<style>"), html.indexOf("</style>") + 8);
  return (
    <html lang="ja">
      <head dangerouslySetInnerHTML={{ __html: headStyle }} />
      <body>
        <div dangerouslySetInnerHTML={{ __html: bodyInner }} />
        <button style={{ position: "fixed", bottom: 16, right: 16, padding: "0.5rem 1rem" }} onClick={() => reset()}>
          再試行
        </button>
      </body>
    </html>
  );
}
