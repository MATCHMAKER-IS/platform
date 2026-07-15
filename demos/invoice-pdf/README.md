# @demos/invoice-pdf — 請求書 PDF 出力(@platform/pdf × @platform/invoice)

`renderInvoiceHtml`（invoice）で請求書を HTML 描画し、`createPdf(renderer).fromHtml`（pdf）で PDF 化します。

```ts
import { issueInvoicePdf } from "@demos/invoice-pdf";
import { createPlaywrightRenderer } from "@platform/pdf";

const renderer = createPlaywrightRenderer(/* ... */);
const result = await issueInvoicePdf(
  { number: "INV-202507-0001", issueDate: "2025-07-01", dueDate: "2025-07-31", billTo: "株式会社◯◯", registrationNumber: "T1234567890123" },
  [{ description: "コンサル料", quantity: 10, unitPrice: 10000 }, { description: "書籍(軽減)", quantity: 3, unitPrice: 2000, taxRate: 8 }],
  renderer,
  "当社株式会社",
);
// result.ok なら result.value に PDF バイト列(HTML→PDF は Playwright レンダラ等で実行)
```

税率区分ごとの内訳・登録番号を含む A4 レイアウトで出力されます。描画は純ロジック、PDF 変換だけ環境依存。
