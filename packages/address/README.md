# @platform/address

郵便番号から住所を逆引きする共通部品(Adapter パターン)。

- `createZipcloudAdapter()` … 既定。認証不要・無料(zipcloud、日本郵便データ由来)。

```ts
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
