# @platform/print

印刷用のスタイル（帳票・ラベル）。**画面で見えるものが、そのまま紙に出るとは限りません**。

## これは何のためか

**画面で見えるものが、そのまま紙に出るとは限りません。**

背景色が出ない、ページが変なところで切れる、
リンクの URL が見えない——**紙に出して初めて気づきます**。

## 使う前に知っておくこと

| | |
|---|---|
| **必ず紙に出して確かめる** | プレビューと**実際の印刷は違います**——特に**余白**です |
| **背景色は出ません** | ブラウザの既定で**印刷されません**。**枠線か文字で**区別してください |
| **向きは `size` に含める** | `A4 landscape` のように書きます——**別々に指定できません** |
| **ページの区切りを指定する** | 明細の途中で切れると、**読めない帳票**になります |
| **色に頼らない** | **白黒で印刷される**ことがあります |

## よく使うもの

```ts
import { pageCss, printHtml, printPage } from "@platform/print";
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
