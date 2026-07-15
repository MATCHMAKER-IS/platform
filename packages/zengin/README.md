# @platform/zengin

全銀協レコードフォーマット(総合振込)の生成(純関数)。給与・支払データを
固定長・半角カナの全銀フォーマット文字列にします。ヘッダ/データ/トレーラ/エンドを組み立て。

```ts
import { buildZenginTransfer } from "@platform/zengin";

const { content, count, totalAmount } = buildZenginTransfer(consignor, [
  { bankCode: "0005", branchCode: "100", accountType: "1", accountNumber: "7654321",
    recipientName: "ヤマダタロウ", amount: 150000 },
], "0725"); // 振込指定日 MMDD

// content を Shift_JIS で出力してネットバンキングへ取込
```

件数・合計はトレーラに自動集計。半角カナ変換・金額の妥当性検証つき。経理の振込データ作成に。
