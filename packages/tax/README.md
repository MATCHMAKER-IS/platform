# @platform/tax

日本の消費税・インボイス(適格請求書)ユーティリティ(純関数)。
税込/税抜変換・軽減税率(8%)混在・端数処理の選択・税率別集計・登録番号検証。

```ts
import { grossFromNet, netFromGross, summarizeTax, isValidInvoiceNumber } from "@platform/tax";

grossFromNet(1000, 10);   // 1100(税抜→税込)
netFromGross(1100, 10);   // 1000(税込→税抜・浮動小数点誤差なし)

// 適格請求書: 税率ごとに区分して集計(区分合計で1回だけ丸める)
summarizeTax([
  { net: 3000, rate: 10 },
  { net: 500, rate: 8 },   // 軽減税率
]); // { byRate:[10%,8%], net:3500, tax:340, gross:3840 }

isValidInvoiceNumber("T1234567890123"); // 登録番号(法人番号チェックディジット込み)
```

端数処理は `floor`(既定・切り捨て)/`round`/`ceil` から選べます。経費・請求・見積・発注に。

## 源泉徴収税
報酬・料金等の源泉徴収税(所得税+復興特別所得税)を計算します。
```ts
import { withholdingTax, applyWithholding } from "@platform/tax";
withholdingTax(100_000);   // 10,210(10.21%)
withholdingTax(2_000_000); // 306,300(100万超は20.42%)
applyWithholding(500_000); // { base:500000, withholding:51050, net:448950 }
```
標準税率は 100万円以下 10.21% / 超過分 20.42%(円未満切り捨て)。消費税が区分記載されている場合は
税抜(報酬本体)を対象にしてください。司法書士等の定額控除型は `withholdingTaxFlat(base, deduction)` を使います。

