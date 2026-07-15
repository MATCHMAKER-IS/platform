# @platform/invoice — 請求書(適格請求書対応)

明細計算・税率別集計・番号採番・支払期限/入金状態。消費税計算は `@platform/tax` に委譲します。

## 主な API
- `lineNet(line)` / `lineTaxRate(line)` — 明細の税抜金額(数量×単価−割引)と税率。
- `invoiceTotals(lines, rounding?)` — 小計・**税率区分ごとの消費税**(適格請求書要件)・合計。
- `buildInvoice(header, lines)` — ヘッダ + 明細 → 合計を埋めた請求書。
- `formatInvoiceNumber(seq, { prefix, date, padding })` / `parseInvoiceSequence` — 自社番号の採番/逆引き。
- `dueDateFrom` / `endOfNextMonth` / `paymentStatus` / `balanceDue` / `daysUntilDue` — 支払期限・入金状態。
- `isValidInvoiceNumber` / `normalizeInvoiceNumber` — 適格請求書発行事業者の登録番号(T+13桁)検証(`@platform/tax` 再エクスポート)。

```ts
import { buildInvoice, paymentStatus } from "@platform/invoice";

const invoice = buildInvoice(
  { number: "INV-202507-0001", issueDate: "2025-07-01", dueDate: "2025-07-31", billTo: "株式会社◯◯", registrationNumber: "T1234567890123" },
  [
    { description: "コンサル料", quantity: 10, unitPrice: 10000 },              // 10%
    { description: "書籍(軽減税率)", quantity: 3, unitPrice: 2000, taxRate: 8 }, // 8%
  ],
);
// invoice.totals: { subtotal, tax(税率別に丸め), total, taxByRate:[{rate:10,...},{rate:8,...}] }
```

消費税は**税率区分ごとに 1 回だけ端数処理**します(明細ごとに丸めない=インボイス要件)。
