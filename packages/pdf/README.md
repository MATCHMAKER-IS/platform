# @platform/pdf

帳票 PDF 生成(HTML → PDF)。請求書・報告書を HTML/CSS でレイアウトして PDF 化します。

- `createPlaywrightRenderer()` … 本番用(ヘッドレス Chromium)。要 `npx playwright install chromium`。
- テストはスタブレンダラを注入(ブラウザ不要)。

```ts
import { createPdf, createPlaywrightRenderer } from "@platform/pdf";
const renderer = createPlaywrightRenderer();
const pdf = createPdf(renderer);
const res = await pdf.fromHtml(invoiceHtml, { format: "A4" });
if (res.ok) await storage.put("invoices/2026-01.pdf", res.value);
await renderer.close();
```

日本語フォントは HTML 側で指定します(`font-family` に Noto Sans JP 等)。
