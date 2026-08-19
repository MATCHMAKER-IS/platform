"use client";
/**
 * レイアウトごと壊れたときの最後の受け皿。
 *
 * 【`error.tsx` との違い】
 * `error.tsx` はレイアウトの**中**で描かれるので、
 * レイアウト自身が壊れると出せない。
 * ここは `<html>` から自分で組み立てるため、その場合でも表示できる。
 *
 * 【なぜ基盤の部品を使わないか】
 * **基盤の読み込みで失敗している可能性がある。**
 * ここで `@platform/ui` を呼ぶと、同じ理由で二重に落ちる。
 * 素の HTML と、自前で書いた文字列だけで組む。
 * @packageDocumentation
 */

/** 最小限の見た目。**外部の CSS に頼らない**(それも読めていない可能性がある)。 */
const style = `
  body { font-family: system-ui, sans-serif; margin: 0; padding: 2rem; line-height: 1.7; }
  main { max-width: 32rem; margin: 4rem auto; }
  h1 { font-size: 1.25rem; margin: 0 0 .5rem; }
  p { color: #555; margin: .25rem 0; }
  code { background: #f2f2f2; padding: .1rem .3rem; border-radius: 3px; }
  button { margin-top: 1.5rem; padding: .5rem 1.25rem; font-size: 1rem; cursor: pointer; }
`;

export default function GlobalError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    // **`lang` を付ける。** 読み上げが言語を判断できない
    <html lang="ja">
      <head>
        {/* unsafe-html: 自前の定数のみ。利用者の入力は入らない */}
        // safe-source: @platform/status-page の renderErrorPage が組み立てた定型 HTML。利用者入力を含まない
        <style dangerouslySetInnerHTML={{ __html: style }} />
      </head>
      <body>
        <main>
          <h1>問題が発生しました</h1>
          <p>画面を表示できませんでした。もう一度お試しください。</p>
          {/* **例外の中身は見せない。** 内部の作りや値が漏れる。
              直す人が追えるよう、識別子だけを示す */}
          {error.digest !== undefined && (
            <p>
              調査用の番号: <code>{error.digest}</code>
            </p>
          )}
          <p>解消しない場合は、この番号を添えて管理者にご連絡ください。</p>
          <button type="button" onClick={reset}>もう一度読み込む</button>
        </main>
      </body>
    </html>
  );
}
