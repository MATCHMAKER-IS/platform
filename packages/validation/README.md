# @platform/validation

日本の業務で使う識別子の検証（法人番号・マイナンバー・適格請求書番号）。

## これは何のためか

**「形が正しいか」を確かめる**ためのものです。

**実在するかは分かりません**——それは**外部の照会**が要ります。

## 使う前に知っておくこと

| | |
|---|---|
| **種類ごとに検証の強さが違います** | 法人番号とマイナンバーは**チェックディジット**があり、**打ち間違いを検出できます**。適格請求書番号は**形だけ**です |
| **検証の前に必ず正規化** | ハイフンや全角が混ざります——**そのまま検証すると、正しい番号を弾きます** |
| **形が正しくても実在するとは限りません** | **国税庁の照会**が別に要ります |
| **マイナンバーは扱いに注意** | **保管には法令上の制限**があります——**要らないなら持たない**のが最善です |

## よく使うもの

```ts
import { normalizeDocumentNumber, isValidDriversLicenseNumber, isValidJapanPassportNumber } from "@platform/validation";
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

