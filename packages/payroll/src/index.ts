/**
 * `@platform/payroll` — 勤怠・給与計算(労働基準法)。
 * 出退勤からの労働時間集計、時間外・深夜・法定休日の割増賃金、月次集計、給与明細の組み立て。
 * 基盤は計算の部品のみを提供し、就業規則・料率などの方針はアプリ側で与える。
 * @packageDocumentation
 */
export * from "./worktime.js";
export * from "./premium.js";
export * from "./payslip.js";
export * from "./render.js";
