# @platform/payroll

勤怠・給与計算(労働基準法)。出退勤からの労働時間集計、時間外・深夜・法定休日の割増賃金、
月次集計、給与明細の組み立て。基盤は計算の部品のみを提供し、就業規則・料率などの方針はアプリ側で与えます。

## 勤怠の集計
```ts
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
