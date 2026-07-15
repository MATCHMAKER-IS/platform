# @platform/accounting — 会計(複式簿記の仕訳)

業務イベントを勘定科目つきの複式仕訳に変換し、貸借均衡・試算表・freee 連携をサポートします。

## 主な API
- **仕訳**: `JournalEntry`/`isBalanced`/`debitTotal`/`creditTotal`。
- **業務イベント → 仕訳**: `salesJournal`（売掛金/売上高・仮受消費税）、`purchaseJournal`（仕入高・仮払消費税/買掛金）、
  `receiptJournal`（現金預金/売掛金）、`paymentJournal`（買掛金/現金預金）。勘定科目は `AccountNames` で差し替え可。
- **試算表**: `trialBalance`（勘定科目別 借方/貸方/残高）/`trialBalanceBalanced`。
- **freee 連携**: `toFreeeDetails`（振替伝票明細へ変換 → `@platform/freee` の `buildManualJournal`）。

```ts
import { salesJournal, trialBalance, toFreeeDetails } from "@platform/accounting";
const entry = salesJournal({ date: "2025-07-01", net: 100000, tax: 10000 }); // 貸借一致した仕訳
toFreeeDetails(entry); // freee 振替伝票の details へ
```
請求(@platform/invoice）の税率別集計と組み合わせれば、売上計上の仕訳が自動生成できます。
