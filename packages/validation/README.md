# @platform/validation

zod をベースにした共通バリデーション。日本の業務アプリで頻出するパターンを集約しています。

## 主なスキーマ
- 文字列: `requiredString` / `optionalString` / `email` / `url`
- 日本固有: `zipCodeJp` / `phoneJp` / `mobileJp` / `katakana` / `hiragana` / `prefecture`
  / `myNumber`(チェックディジット検証)/ `corporateNumber`(同)
- 数値: `positiveInt` / `amount`(円)/ `percentage`
- その他: `uuid` / `agreement`(同意チェック)/ `dateString`

## 追加パターン
- 文字種: `alphanumeric`(半角英数字)/ `halfWidthKana`(半角カナ)
- 金融: `creditCard`(Luhn 検証)/ `bankCode` / `branchCode` / `accountNumber`
- その他: `time`(HH:mm)/ `httpsUrl`

## フォームパターン
- `password(options)` … 強度要件(長さ・文字種)
- `passwordWithConfirm()` … パスワード確認一致
- `dateRange()` … 開始日 ≤ 終了日
- `between(min, max)` … 数値範囲 / `futureDate()` / `pastDate()`
- `nonEmptyArray(item)` … 1件以上必須 / `fileConstraints({ maxSizeBytes, allowedMimeTypes })` … アップロード検証

## 正規化
- `toHalfWidth` / `digitsToHalfWidth` / `normalizeSpace`(検証前の前処理)

```ts
import { validate, z, email, phoneJp, prefecture, passwordWithConfirm } from "@platform/validation";

const schema = z.object({ email, phone: phoneJp, pref: prefecture });
const res = validate(schema, formData);
if (!res.ok) showErrors(res.error);
```

> マイナンバー・法人番号のチェックディジットは公式アルゴリズムに準拠(実在の法人番号で検証済み)。
> 全角数字は自動で半角に正規化してから検証します。

## 本人確認書類の書式検証(KYC 部品)
`isValidMyNumber`(既存・チェックディジット)に加え、書類番号の**書式検証**を提供します。
```ts
import { isValidDriversLicenseNumber, isValidJapanPassportNumber, isValidResidenceCardNumber, validateIdentityDocument } from "@platform/validation";
isValidDriversLicenseNumber("123456789012"); // 運転免許証(12桁)
isValidJapanPassportNumber("TK1234567");     // 日本国旅券(英字2+数字7)
isValidResidenceCardNumber("AB12345678CD");  // 在留カード(英字2+数字8+英字2)
validateIdentityDocument("passport", value); // 種別指定で検証
```
> これは**書式チェック**です。書類の真正性・実在確認(eKYC・顔照合・犯収法対応)は
> 専用ベンダーに委ねてください。基盤は入力ミス検出・保存前チェック用の軽量部品です。

