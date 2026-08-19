# @platform/invoice

請求書と見積書。**インボイス制度**（登録番号・税率ごとの内訳）に対応しています。

## これは何のためか

**請求書は「出したら終わり」ではありません。**
金額が違えば作り直し、日付が違えば税率が変わります。

**インボイス制度で、登録番号と税率ごとの内訳が必須**になりました——
書き漏らすと**相手が仕入税額控除を受けられません**。

## 使う前に知っておくこと

| | |
|---|---|
| **税率は型で縛られています** | `10 \| 8 \| 0` です——**`0.1` を渡すと型エラー**。**比率とパーセントの取り違えで 100 倍ずれます** |
| **承認前の見積からは作れません** | 例外になります——**口約束で請求書を出さない**ためです |
| **登録番号は必須** | インボイス制度の要件です。**空だと相手が控除を受けられません** |
| **税率ごとに内訳を出す** | 8% と 10% が混ざる請求書では**必須**です |

## よく使うもの

```ts
import { dunningLevel, dunningMessage, shouldSendDunning } from "@platform/invoice";
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
