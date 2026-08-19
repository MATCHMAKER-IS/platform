# @platform/tax

消費税の計算（10% / 8% / 非課税）。**丸め方が決まっています**。

## これは何のためか

**消費税は「だいたい」では通りません。**
**1 円の違いでも、取引先から指摘されます**。

## 使う前に知っておくこと

| | |
|---|---|
| **負の金額でも対称に丸めます** | **`Math.round(-2.5)` は -2** です（-3 ではありません）——**返品や値引きで、額がずれます**。ここでは対称に丸めています |
| **税率は型で縛られています** | `10 \| 8 \| 0` です——**`0.1` を渡すと型エラー**。**比率とパーセントの取り違えで 100 倍ずれます** |
| **端数処理は取引先と合わせる** | 切り捨て・切り上げ・四捨五入は**契約で決まる**ことがあります |
| **軽減税率は品目で決まります** | 「食品は 8%」ではありません——**外食は 10%**、**持ち帰りは 8%** です |

## よく使うもの

```ts
import { applyRounding, taxAmount, grossFromNet } from "@platform/tax";
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


## 印紙税(`@platform/tax/stamp`)

契約書や領収書を**紙で作ると課税されます**。貼り忘れると過怠税として本来の
3 倍(自主的に申し出れば 1.1 倍)を取られます。

```ts
import { stampTax, savingsByGoingElectronic } from "@platform/tax/stamp";

stampTax({ documentType: "contract-work", amount: 5_000_000 });  // 請負契約書
savingsByGoingElectronic([{ documentType: "receipt", amount: 300_000, count: 120 }]);
```

- **電子契約は課税されません。** 印紙税は「文書の作成」に対する税なので、PDF を
  メールで送るだけなら課税文書を作成したことになりません(国税庁の見解)。
  契約書 1 通あたり数万円が浮くため、電子契約に切り替える経済的な根拠になります。
  ただし**電子で締結したものを印刷して押印すると課税されます**。
- 第 2 号(請負)と第 7 号(継続的取引)で税額が違う点に注意してください。
