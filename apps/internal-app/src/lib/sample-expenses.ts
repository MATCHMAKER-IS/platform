import type { Expense } from "./expense.js";

/** デモ用の経費サンプル(実運用では Prisma から取得)。 */
export const SAMPLE_EXPENSES: Expense[] = [
  { id: "e01", date: "2024-01-09", category: "交通費", amount: 1240, note: "客先訪問" },
  { id: "e02", date: "2024-01-15", category: "会議費", amount: 8600, note: "打合せ" },
  { id: "e03", date: "2024-01-23", category: "消耗品", amount: 3200 },
  { id: "e04", date: "2024-02-05", category: "交通費", amount: 1560 },
  { id: "e05", date: "2024-02-14", category: "会議費", amount: 12400, note: "接待" },
  { id: "e06", date: "2024-02-27", category: "消耗品", amount: 2800 },
  { id: "e07", date: "2024-03-04", category: "交通費", amount: 1320 },
  { id: "e08", date: "2024-03-12", category: "外注費", amount: 180000, note: "スポット依頼" },
  { id: "e09", date: "2024-03-19", category: "会議費", amount: 9100 },
  { id: "e10", date: "2024-03-25", category: "交通費", amount: 1480 },
  { id: "e11", date: "2024-04-02", category: "消耗品", amount: 4200 },
  { id: "e12", date: "2024-04-18", category: "会議費", amount: 7600 },
];
