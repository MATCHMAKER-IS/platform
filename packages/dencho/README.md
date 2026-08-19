# @platform/dencho

電子帳簿保存法への対応（改ざん検知・タイムスタンプ）。

## これは何のためか

**「後から書き換えていない」ことを示す**ためのものです。

電子帳簿保存法では、**保存した記録が改ざんされていない**ことを
**証明できる形**にしておく必要があります。

## 使う前に知っておくこと

| | |
|---|---|
| **前のハッシュを含めます** | 鎖のように繋ぐので、**途中の 1 件を書き換えると、それ以降が全部合わなくなります**——**どこで改ざんされたか**まで分かります |
| **キーは再帰的にソート** | JSON の並び順が違うだけで**別のハッシュ**になるためです。**同じ内容なら必ず同じ文字列**にしてから計算します |
| **7 年は消せません** | **本人から求められても消せません**（ADR 0018）——法令が優先します |
| **検証は定期的に** | 保存しただけでは意味がありません。**壊れていないか**を定期的に確かめてください |

## よく使うもの

```ts
import { canonicalJson, hashEvidence, appendEvidence } from "@platform/dencho";
import { appendEvidence, verifyEvidenceChain } from "@platform/dencho";

let chain = [];
chain = [...chain, appendEvidence(chain, { invoice: "INV-001", amount: 11000, partner: "山田商事" }, new Date().toISOString())];
chain = [...chain, appendEvidence(chain, { invoice: "INV-002", amount: 22000, partner: "鈴木工業" }, new Date().toISOString())];

const check = verifyEvidenceChain(chain);   // { valid: true } / 改ざん時は { valid:false, brokenAt, reason }
```
データ改ざん・レコード削除・順序変更を検知します(ハッシュを再計算しても後続の連結で露見)。訂正・削除の記録を残す運用と組み合わせます。

## 真実性の補完 — タイムスタンプ
```ts
import { createTimestampToken, verifyTimestampToken, sha256Hex } from "@platform/dencho";
const token = createTimestampToken(sha256Hex(documentBytes), TSA_SECRET);
verifyTimestampToken(token, TSA_SECRET);  // 署名とデータハッシュの一致を検証
```
> ⚠️ 電帳法で認められるタイムスタンプは**認定タイムスタンプ事業者(認定 TSA)**のものである必要があります。本モジュールは内部的な時刻証跡・TSA 応答のラップ用で、認定 TSA の代替ではありません。

## 可視性の確保 — 検索(取引年月日・金額・取引先)
電帳法の検索要件(3項目・範囲指定・2項目以上の組み合わせ)を満たします。
```ts
import { searchTransactions } from "@platform/dencho";
searchTransactions(records, { dateFrom: "2025-07-01", dateTo: "2025-07-31", counterparty: "山田" });
searchTransactions(records, { amountMin: 30000, amountMax: 60000 });
```

## 保存期間の管理
```ts
import { retentionDeadline, isWithinRetention } from "@platform/dencho";
retentionDeadline(startDate, 7);          // 起算日から7年後の前日(国税関係帳簿書類の原則)
isWithinRetention(startDate, 7, new Date());
```
すべて純ロジックで検証済み。
