# @platform/pii

個人情報の伏せ字と暗号化。**外に出す前に隠します**。

## これは何のためか

**AI に送る、ログに残す、外部サービスへ渡す**——
どれも**社外に出る**ことがあります。

**送ってしまったら取り消せません。**

## 使う前に知っておくこと

| | |
|---|---|
| **伏せ方は用途で変える** | メールは**ドメインを残す**（社内外の区別が要る）、カードは**下 4 桁のみ**、氏名は**末尾のみ**——**全部を消すと使えなくなります** |
| **`console.log` は通りません** | 基盤のログは伏せ字を通しますが、**`console.log` は素通り**です |
| **画像の中身は伏せられません** | 領収書の写真を AI に送ると、**店名も日時も場所も写っています** |
| **暗号化と伏せ字は別** | 暗号化は**戻せます**（鍵があれば）。伏せ字は**戻せません**——用途で選んでください |
| **検索したいなら `blindIndex`** | 暗号化したままでは検索できません |

## よく使うもの

```ts
import { maskEmail, maskPartial, blindIndex } from "@platform/pii";
import { maskEmail, blindIndex, createFieldCipher, anonymizeRecord } from "@platform/pii";

maskEmail("taro@example.co.jp");     // "t***@example.co.jp"(表示・ログ用)

// 検索可能暗号: 平文を復号せず「メールで検索」できる決定的ハッシュ列
const idx = blindIndex("taro@example.co.jp", hmacKey);

// フィールド暗号(@platform/crypto を注入)
const cipher = createFieldCipher({ encrypt, decrypt });
const { enc, idx: searchIdx } = cipher.protect("090-1234-5678", hmacKey);

// 削除権: PII だけ匿名化し、集計・監査データは残す
anonymizeRecord(user, ["name", "email"]);
```

DB 保存時の暗号化・保持ポリシー(`isRetentionExpired`)・削除権対応をまとめて扱えます。

## マイナンバー・本人確認番号のマスキング(番号法対応)
```ts
import { maskMyNumber, maskIdentityNumber } from "@platform/pii";
maskMyNumber("123456789018");        // "************"(既定=全桁マスク)
maskMyNumber("123456789018", 4);     // "********9018"(下4桁のみ・上限4桁)
maskIdentityNumber("AB12345678CD");  // "********78CD"(末尾4桁表示)
```
マスキングは**表示用**です。保存はフィールド暗号(`createFieldCipher`)、
突合は検索可能暗号(`blindIndex`)を併用してください。

## 本人の権利対応(個人情報保護法 — 開示・削除)
保有個人データの開示請求への回答、削除/利用停止請求の適用、保持期間超過データの抽出。
```ts
import { buildDisclosureReport, disclosureToJson, erasePersonalData, buildErasureReceipt, recordsToErase } from "@platform/pii";

// 開示請求: 保有個人データ(内容・利用目的・第三者提供先)をまとめて回答
const report = buildDisclosureReport({ subjectId, entries, categories });
const json = disclosureToJson(report);   // 可搬JSON(データポータビリティ)

// 削除/利用停止請求: PII を匿名化(関連データは保持)または完全削除
const { record, erasedFields } = erasePersonalData(userRecord, ["name", "email", "phone"]);
const receipt = buildErasureReceipt(subjectId, erasedFields, "anonymize");  // 対応の証跡

// 保持期間経過データを定期削除(利用目的達成後は遅滞なく消去)
const expiredIds = recordsToErase(records, Date.now());
```
`categories` に利用目的・保持期間・第三者提供先を登録しておくと、開示レポートに自動で反映されます。マスク・暗号化・匿名化(下位部品)の上に構築されています。

