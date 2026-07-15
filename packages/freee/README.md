# @platform/freee

freee 会計 API クライアント + OAuth トークン管理 + 証憑・振替伝票。
取引・請求書・見積・経費申請・レポートに加え、経費精算で必須の証憑アップロードや
会計処理(振替伝票・仕訳帳)まで扱えます。

```ts
import { createFreeeClient, createFreeeTokenManager, createFreeeAuthedFetch } from "@platform/freee";

// トークン自動更新(freee のトークンは約6時間で失効)
const tokens = createFreeeTokenManager({
  clientId: env.FREEE_CLIENT_ID, clientSecret: env.FREEE_CLIENT_SECRET,
  refreshToken: saved.refreshToken,
  onRefresh: (t) => db.saveFreeeTokens(t), // 新トークンを永続化
});
const freee = createFreeeClient({ accessToken: "", fetchImpl: createFreeeAuthedFetch(tokens) });
```

## トークン管理(必須)
`createFreeeTokenManager` … リフレッシュトークンで自動更新(同時更新は1本化・401 で自動リトライ)。
freee はリフレッシュトークンもローテーションするため、`onRefresh` で必ず新トークンを保存します。

## 証憑(ファイルボックス)
```ts
await freee.uploadReceipt(companyId, { filename: "receipt.jpg", data: bytes, contentType: "image/jpeg" }, "タクシー代");
```
経費精算での領収書添付に。`getReceipts`/`getReceipt` で参照。

## 振替伝票・仕訳帳
```ts
import { buildManualJournal } from "@platform/freee";
const journal = buildManualJournal({ companyId, issueDate: "2025-07-11", details: [
  { entrySide: "debit", accountItemId: 100, taxCode: 0, amount: 11000 },
  { entrySide: "credit", accountItemId: 200, taxCode: 0, amount: 11000 },
] }); // 借方=貸方を検証
await freee.createManualJournal(journal);
```
`requestJournals` で仕訳帳ダウンロード、`createDealPayment` で支払消し込み。

トークンの取得・永続化はアプリ側の責務です。単純な取引取得だけならクライアントだけで足ります。

## マスタ・セグメント
`getSegmentTags(companyId, 1|2|3)` でセグメントタグを取得できます(管理会計の集計軸)。

## 人事労務 API(勤怠・給与)
会計とは別サービス(`createFreeeHrClient`)。従業員・勤怠記録・月次集計・給与明細を扱います。
```ts
import { createFreeeHrClient } from "@platform/freee";
const hr = createFreeeHrClient({ accessToken, fetchImpl: createFreeeAuthedFetch(tokens) });
await hr.putWorkRecord(employeeId, { date: "2025-07-25", clockInAt: "2025-07-25T09:00:00", clockOutAt: "2025-07-25T18:00:00" }, companyId);
await hr.getWorkRecordSummary(employeeId, 2025, 7, companyId); // 月次の勤怠集計
```

## 承認ワークフロー
```ts
await freee.actionExpenseApplication(companyId, expenseAppId, "approve", { comment: "承認します" });
await freee.getApprovalRequests(companyId, { applicationType: "expense_application" });
await freee.actionApprovalRequest(companyId, requestId, "approve", { approvalStep: 2 });
```

## Webhook 受信
```ts
import { verifyFreeeSignature, parseFreeeWebhook } from "@platform/freee";
if (!verifyFreeeSignature(rawBody, req.headers["x-freee-signature"], env.FREEE_WEBHOOK_SECRET)) return;
for (const event of parseFreeeWebhook(rawBody)) { /* event.type = "deal.created" 等 */ }
```

