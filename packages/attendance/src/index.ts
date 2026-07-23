/**
 * `@platform/attendance` — 勤怠の記録・集計と、年次有給休暇。
 *
 * 給与計算(`@platform/payroll`)の**入力を作る**層。
 * 打刻から労働時間・残業・深夜・休日を出し、月次で集計する。
 * 有給は法律で日数と時効が決まっているため、ここに持つ。
 *
 * 取得の申請と承認は業務の流れなので `@platform/workflow` の担当。
 * @packageDocumentation
 */
export * from "./core";
export * from "./leave";
