/**
 * `@platform/booking` — 予約サイトの基盤処理。
 * 営業時間・スロット生成・空き枠計算(キャパシティ考慮)・予約ルール(受付期間/キャンセル)・
 * 予約ステータスの純ロジック部品。日時計算は @platform/datetime、表示は @platform/ui の
 * schedule-calendar / resource-schedule、ステータス遷移は @platform/fsm と組み合わせる。
 * @packageDocumentation
 */
export * from "./hours";
export * from "./slots";
export * from "./availability";
export * from "./rules";
export * from "./status";
export * from "./reminders";
export * from "./shift";
