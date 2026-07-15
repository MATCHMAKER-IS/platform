# @platform/phone

日本の電話番号 + 国際(E.164)ユーティリティ。正規化・種別判定・整形・マスキング。

```ts
import { normalizePhone, phoneType, isValidJpPhone, toE164, formatJpPhone } from "@platform/phone";

normalizePhone("０９０－１２３４－５６７８"); // "09012345678"(全角/ハイフン吸収)
phoneType("0312345678");                       // "landline"(固定/携帯/フリーダイヤル等)
toE164("09012345678");                          // "+819012345678"(SMS 送信用)
formatJpPhone("0312345678");                    // "03-1234-5678"
```

フォーム入力の正規化・バリデーション、SMS 送信前の E.164 変換に。国際番号にも対応。
