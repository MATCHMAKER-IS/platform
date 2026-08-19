# @platform/payroll

給与計算（社会保険・源泉徴収・賞与）。**金額が 1 円違うと問い合わせが来ます**。

## これは何のためか

**給与は「だいたい合っている」では済みません。**
**1 円の違いでも本人から問い合わせが来ます**——
そして**説明できないと信用を失います**。

## 使う前に知っておくこと

| | |
|---|---|
| **賞与の上限は 2 種類** | **健康保険は年度累計で 573 万円**、**厚生年金は 1 回ごとに 150 万円**——**数え方が違います** |
| **源泉徴収は甲欄だけ** | **乙欄（他社が主たる給与の人）は未対応**です。副業の人がいたら**税額表の乙欄を足して**ください |
| **社会保険は前月の給与から** | 当月ではありません——**入社月の扱い**を間違えやすいところです |
| **課税所得は 1,000 円未満を切り捨て** | 端数の扱いは**法令で決まっています**。独自に丸めないでください |
| **等級表は引数で差し替えられます** | 料率は毎年変わります——**表を更新すれば計算は変えなくて済みます** |

## よく使うもの

```ts
import { calcInsuranceDeduction, buildPayslip } from "@platform/payroll";
import { splitDailyWork, parseTimeToMinutes } from "@platform/payroll";
const t = parseTimeToMinutes;
// 9:00-20:00 休憩60分 → 実働10h・時間外2h・深夜0
splitDailyWork({ startMin: t("09:00"), endMin: t("20:00"), breakMinutes: 60 });
// 深夜(22:00〜翌5:00)や法定休日も区分。日をまたぐ勤務は endMin に 1440 を足す
splitDailyWork({ startMin: t("22:00"), endMin: 1440 + t("06:00"), breakMinutes: 60 });
```

## 割増賃金(労基法の最低基準)
時間外25% / 深夜25% / 法定休日35%。割増は重複します(深夜残業=50%、法定休日の深夜=60%)。
```ts
import { calcPay, aggregateMonthly, calcMonthlyPay } from "@platform/payroll";

// 月60時間超の時間外は50%(aggregateMonthly が自動で over60 を算出)
const month = aggregateMonthly(dailySplits);
const pay = calcMonthlyPay(month, hourlyWage);
// pay.base / overtimePremium / over60Premium / nightPremium / holidayPay / total
```
料率は就業規則で上書き可能(`calcPay(input, { overtime: 0.3, ... })`)。

## 給与明細
```ts
import { buildPayslip } from "@platform/payroll";
const slip = buildPayslip(pay, {
  allowances: [{ name: "通勤手当", amount: 10000 }],
  deductions: [{ name: "健康保険", amount: 15000 }, { name: "所得税", amount: 8000 }],
});
// slip.grossPay(総支給) / totalDeductions(控除合計) / netPay(差引支給)
```
社会保険料・所得税は料率・等級で変わるため**算出済みの金額**を渡す形です(源泉徴収は `@platform/tax` の `withholdingTax` を利用可)。すべて純ロジックで検証済み。
