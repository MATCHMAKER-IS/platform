# @platform/address

住所と郵便番号（正規化・検索）。**入力の揺れを吸収**します。

## これは何のためか

**利用者は住所を自由に書きます。**

「1-2-3」「１−２−３」「一丁目二番三号」——
**同じ住所が別のものとして保存される**と、突き合わせができません。

## 使う前に知っておくこと

| | |
|---|---|
| **正規化は桁を見ません** | `normalizeZipcode` は**形を整えるだけ**です。**7 桁かどうかは別に検証**してください |
| **検証してから外部 API へ** | 誤入力をそのまま送ると、**無駄な呼び出しと料金**が発生します |
| **住所は完全には正規化できません** | ビル名・部屋番号は**書き方が無限**です。**突き合わせに使うのは番地まで**にしてください |
| **郵便番号から住所は引けますが、逆は不確実** | 1 つの住所に**複数の郵便番号**があることがあります |

## よく使うもの

```ts
import { normalizeZipcode, isValidZipcode } from "@platform/address";
import { createAddressLookup, createZipcloudAdapter } from "@platform/address";
const address = createAddressLookup(createZipcloudAdapter());
const res = await address.lookup("100-0001"); // 全角・ハイフン混在OK
if (res.ok && res.value[0]) {
  const { prefecture, city, town } = res.value[0]; // 東京都 / 千代田区 / 千代田
}
```

> 商用・大量利用や最新性が重要な場合は、日本郵便公式「郵便番号・デジタルアドレス API」
> (要ゆうID + OAuth)を別 Adapter として追加できます。zipcloud は公式サポートが無いため
> 利用規約と可用性に留意してください。
