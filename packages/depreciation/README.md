# @platform/depreciation

減価償却（定額法・定率法）。**税法の決まりに沿って計算**します。

## これは何のためか

**減価償却は「だいたい」では通りません。**
税務調査で指摘されるのは、**細かい決まりを守っていない**ところです。

## 使う前に知っておくこと

| | |
|---|---|
| **最終年度に 1 円を残します** | **備忘価額**といい、税法上の決まりです——**0 にしてはいけません** |
| **定率法は途中で定額法に切り替わります** | **改定償却率**を下回ったときです。**知らないと最後まで定率で計算して合いません** |
| **円未満は切り捨て** | 四捨五入ではありません |
| **耐用年数は資産の種類で決まっています** | **勝手に決められません**——省令の表に従ってください |
| **期中取得は月割り** | 年の途中で買ったものは、**使った月数分**だけです |

## よく使うもの

```ts
import { straightLineRate, decliningBalanceRate, straightLineSchedule } from "@platform/depreciation";
import { depreciationSchedule, bookValueAt, monthlyAmount } from "@platform/depreciation";

const asset = { cost: 1_200_000, usefulLifeYears: 5, method: "straight-line" as const };

// 年次の償却表（取得年度から耐用年数ぶん）
const rows = depreciationSchedule(asset, 2026);
// → [{ year: 2026, amount: 240000, accumulated: 240000, bookValue: 960000 }, …]

const value = bookValueAt(rows, 2028, asset.cost);   // その年度末の簿価
const perMonth = monthlyAmount(rows[0].amount);      // 月割（期中取得のとき）
```

## 押さえていること

| 点 | 内容 |
|---|---|
| **備忘価額 1 円を残す** | 最後まで償却しても 0 にしない。**除却するまで資産として残る**ため（`MEMORANDUM_VALUE`） |
| **定率法は定額法へ切り替わる** | 償却額が一定を下回ると定額法に切り替える（200% 定率法）。切替を忘れると耐用年数内に償却しきれない |
| 償却率の既定 | 定率法は `2 ÷ 耐用年数`。個別に決まっているなら `rate` で渡す |
| 月割 | 期中に取得した資産は月割。`monthlyAmount` が年額から出す |

## 償却方法の選び方

| 方法 | 特徴 | 使いどころ |
|---|---|---|
| `straight-line`（定額法） | 毎年同額 | 建物・ソフトウェア（法令で定額法のみのものがある） |
| `declining-balance`（定率法） | 初年度が大きい | 機械・器具備品（早期に費用化したい場合） |

**どちらを選ぶかは税務の判断**です。資産の種類によっては選べません。
会計事務所と決めた方法を、資産ごとに保存してください。

## 扱わないこと

- **資産の登録・管理** … アプリ側の担当（`apps/internal-app` の固定資産台帳が例）
- **少額資産の一括償却・特例** … 判断が要るため、必要になったら足す
- **除却・売却の処理** … 仕訳は `@platform/accounting`

## 確認

`/depreciation` のデモで、耐用年数や取得価額を変えて表の変化を見られます。
