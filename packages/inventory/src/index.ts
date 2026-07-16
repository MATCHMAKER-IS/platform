/**
 * `@platform/inventory` — 在庫管理。入出庫台帳・発注点・在庫評価(移動平均）。
 * 発注入荷(@platform/purchase）や売上出荷を入出庫として記録し、現在庫・補充要否・在庫金額を求める。
 * @packageDocumentation
 */
export * from "./movements";
export * from "./reorder";
export * from "./valuation";
export * from "./warehouse";
export * from "./lot";
