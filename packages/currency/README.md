# @platform/currency

通貨・為替ユーティリティ(純関数)。通貨メタ・端数処理・レート換算・複数通貨合算。
金額は「最小単位の整数」ではなく通常の数値で扱い、端数は通貨の小数桁で丸めます。

```ts
import { money, formatMoney, convert, sumMoney } from "@platform/currency";

const price = money(1980, "JPY");
formatMoney(price);                    // "￥1,980"
convert(money(100, "USD"), "JPY", 150); // 100USD → 15,000JPY
sumMoney([money(100, "JPY"), money(200, "JPY")]); // 合算(通貨不一致は弾く)
```

税計算・請求・複数通貨の集計に。丸めは通貨ごとの小数桁(JPY=0, USD=2)に従います。
