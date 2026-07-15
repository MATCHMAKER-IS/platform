# @platform/report

帳票(請求書・見積書等)。日本の消費税計算と印刷用 HTML を提供します。

```ts
import { renderInvoiceHtml, calculateInvoice } from "@platform/report";
import { createPdf, createPlaywrightRenderer } from "@platform/pdf";

const html = renderInvoiceHtml({
  invoiceNumber: "INV-2026-001", issueDate: "2026-07-09",
  seller: { name: "株式会社サンプル", registrationNumber: "T1234567890123", tel: "03-0000-0000" },
  buyer: { name: "取引先株式会社" },
  lines: [
    { description: "コンサルティング", quantity: 1, unitPrice: 200000, taxRate: 10 },
    { description: "書籍(軽減)", quantity: 3, unitPrice: 1500, taxRate: 8 },
  ],
  notes: "お振込先: ○○銀行 ...",
});

const pdf = await createPdf(createPlaywrightRenderer()).fromHtml(html, { format: "A4" });
// pdf.value を storage.put / ダウンロード配信
```

## 消費税
- 税率別集計(10% 標準 / 8% 軽減 / 0%)
- 外税(税抜単価)/ 内税(税込単価)
- 端数処理(round/floor/ceil)を**税率ごとに1回**(適格請求書=インボイス制度準拠)
- `calculateInvoice` は計算のみ(Web 表示にも利用可)、`renderInvoiceHtml` は印刷用 HTML

登録番号(T+13桁)を seller に記載するとインボイスの記載事項を満たします。

## 見積書・納品書・源泉徴収
請求書と同じ明細構造から、ラベルを変えて見積書・納品書を生成できます。
```ts
import { renderInvoiceHtml, renderQuotationHtml, renderDeliveryNoteHtml } from "@platform/report";
renderQuotationHtml(doc);    // 見積書(見積番号・有効期限・お見積金額)
renderDeliveryNoteHtml(doc); // 納品書(納品書番号・納品金額)
```
源泉徴収は `InvoiceDocument.withholding`(税額)を渡すと、源泉徴収税と差引お支払額を表示します。
税額の計算は `@platform/tax` の `withholdingTax` を使い、**report は金額を受け取るだけ**(疎結合)。
```ts
import { withholdingTax } from "@platform/tax";
renderInvoiceHtml({ ...doc, withholding: withholdingTax(reward) });
```

## 印刷 / PDF 出力(@platform/pdf 連携)
画面向けの帳票 HTML を、PDF 化で用紙サイズ・余白・改ページが正しく効くよう整えます。
```ts
import { printableInvoiceHtml, combineForPrint } from "@platform/report";
import { createPdf, createPlaywrightRenderer } from "@platform/pdf";

const pdf = createPdf(createPlaywrightRenderer());

// 1件をPDF化(@page A4・表の改ページ制御を注入済みのHTMLを渡す)
const html = printableInvoiceHtml(doc, { format: "A4", margin: "15mm" });
const res = await pdf.fromHtml(html);
if (res.ok) await storage.put("invoices/INV-001.pdf", res.value);

// 月次の全請求書を1つのPDFにまとめる(各帳票を改ページで区切る)
const batch = combineForPrint(invoices.map((d) => printableInvoiceHtml(d)));
const all = await pdf.fromHtml(batch);
```
`printPageCss` / `wrapForPrint` / `injectPrintCss` は任意のHTMLにも使えます。**report は pdf に依存せず**(HTMLを整えるだけ)、PDF変換は `@platform/pdf` が担うので層は分離されています。電帳法対応(`@platform/dencho`)と組み合わせれば、PDF化した帳票のハッシュをチェーンに記録できます。

