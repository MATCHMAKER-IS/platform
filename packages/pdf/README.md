# @platform/pdf

PDF の生成。**請求書・報告書を印刷できる形**にします。

## これは何のためか

**HTML はブラウザによって印刷結果が変わります。**
「自分の画面では 1 ページなのに、相手には 2 ページで届いた」——
**PDF なら、誰が見ても同じ**です。

## 使う前に知っておくこと

| | |
|---|---|
| **Dockerfile に日本語フォントを** | `fonts-noto-cjk` が無いと**豆腐（□□□）**になります。**開発機にはフォントがあるので、本番のコンテナで初めて分かります**——請求書が全部□で出てから気づくのは遅すぎます |
| **金額は `formatYen`** | 手で組むと**マイナスが `¥-500`** になります（帳簿の慣行は `-¥500`） |
| **生成は重い** | 100 件を一度に作ると**数分かかります**。**定期実行か、押してから作る**形にしてください |
| **一度出した PDF は残す** | 「あのとき送った請求書」を**再現できない**と、問い合わせに答えられません |

## よく使うもの

```ts
import { createPdf, DEFAULT_INVOICE_PDF_OPTIONS, createPlaywrightRenderer } from "@platform/pdf";
import { createPdf, createPlaywrightRenderer } from "@platform/pdf";
const renderer = createPlaywrightRenderer();
const pdf = createPdf(renderer);
const res = await pdf.fromHtml(invoiceHtml, { format: "A4" });
if (res.ok) await storage.put("invoices/2026-01.pdf", res.value);
await renderer.close();
```

日本語フォントは HTML 側で指定します(`font-family` に Noto Sans JP 等)。
