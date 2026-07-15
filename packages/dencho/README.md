# @platform/dencho

電子帳簿保存法(電帳法)対応の部品。電子取引データ保存の「真実性の確保」と「可視性の確保」、
保存期間の管理を提供します。基盤は技術的な部品のみを提供し、事務処理規程などの運用は利用側で定めます。

## 真実性の確保 — 改ざん検知(ハッシュチェーン)
各レコードが直前のハッシュを含めてハッシュ化され、途中を書き換えると連鎖が壊れ改ざんを検知できます。
```ts
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
