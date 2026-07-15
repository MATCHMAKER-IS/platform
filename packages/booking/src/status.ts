/**
 * 予約ステータス(純ロジック)。
 * リクエスト→確定→来店/完了、およびキャンセル・無断キャンセルの遷移を管理する。
 * @packageDocumentation
 */

/** 予約ステータス。 */
export type BookingStatus = "requested" | "confirmed" | "completed" | "cancelled" | "no_show";

/** 各ステータスから遷移可能なステータス。 */
export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  requested: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled", "no_show"],
  completed: [],
  cancelled: [],
  no_show: [],
};

/** 日本語ラベル。 */
export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  requested: "リクエスト中",
  confirmed: "予約確定",
  completed: "来店完了",
  cancelled: "キャンセル",
  no_show: "無断キャンセル",
};

/** from → to の遷移が許されているか。 */
export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from].includes(to);
}

/** 次に遷移可能なステータス。 */
export function nextStatuses(from: BookingStatus): BookingStatus[] {
  return BOOKING_TRANSITIONS[from];
}

/** 終端(確定後に動かない)か。 */
export function isFinalStatus(status: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[status].length === 0;
}

/** 予約が有効(枠を占有する)か。requested/confirmed は占有、キャンセル系は解放。 */
export function isActiveBooking(status: BookingStatus): boolean {
  return status === "requested" || status === "confirmed";
}
