# @platform/print

印刷処理。ブラウザ印刷とサーマルプリンタ(ESC/POS)。

## ブラウザ印刷(画面遷移なし)
```ts
import { printHtml, printElement, printPage, pageCss } from "@platform/print";
import { renderInvoiceHtml } from "@platform/report";

await printHtml(renderInvoiceHtml(doc), { title: "請求書", pageStyle: pageCss({ size: "A4" }) });
await printElement(document.getElementById("receipt")!); // 特定要素だけ(現在のCSSを複製)
printPage();                                             // ページ全体
```

## レシート(ESC/POS サーマルプリンタ)
```ts
import { createReceipt } from "@platform/print";
const bytes = createReceipt()
  .init().align("center").bold(true).size(2, 2).line("領収書").size(1, 1).bold(false)
  .align("left").line("合計  ¥1,320").feed(1).cut().build();
// @platform/bluetooth の write や Web Serial/USB で送信
```
> 日本語印字は機種のコードページ(多くは Shift_JIS)依存。必要なら `raw()` で
> コードページ設定＋エンコード済みバイトを送る。ASCII 範囲は `text`/`line` で安全。

UI では `usePrint()` フックと `PrintButton` が使えます(@platform/ui)。
