# @platform/zengin

全国銀行協会フォーマット（振込データ）。**銀行に渡すファイル**を作ります。

## これは何のためか

**給与や支払いを、銀行にまとめて依頼する**ためのものです。

1 件ずつ振り込むと、**手数料も手間も件数分**かかります。

## 使う前に知っておくこと

| | |
|---|---|
| **1 行は 120 桁** | **1 桁ずれると銀行が受け付けません**——しかも**エラーの理由が分かりにくい**です |
| **半角カナのみ** | 全角も小文字も使えません。**濁点は 1 文字**として数えます（「ガ」は「カ゛」で 2 桁） |
| **桁数いっぱいは通します** | ちょうど収まるものは切りません——**超えたときだけ**弾きます |
| **テストは必ず銀行と** | 形式が合っていても、**銀行ごとの決まり**があります |
| **金額は円単位** | 小数はありません |

## よく使うもの

```ts
import { toHankakuKana, buildHeader, buildDataRecord } from "@platform/zengin";
import { buildZenginTransfer } from "@platform/zengin";

const { content, count, totalAmount } = buildZenginTransfer(consignor, [
  { bankCode: "0005", branchCode: "100", accountType: "1", accountNumber: "7654321",
    recipientName: "ヤマダタロウ", amount: 150000 },
], "0725"); // 振込指定日 MMDD

// content を Shift_JIS で出力してネットバンキングへ取込
```

件数・合計はトレーラに自動集計。半角カナ変換・金額の妥当性検証つき。経理の振込データ作成に。
