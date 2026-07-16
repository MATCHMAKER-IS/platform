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

/**
 * 予約ステータスの遷移が許されるかを判定する。
 *
 * @param from 現在のステータス
 * @param to 変えたいステータス
 * @returns 許されるなら true
 */
export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from].includes(to);
}

/**
 * 次に遷移できるステータスを返す。
 *
 * **画面のボタンを出し分ける**のに使う。
 *
 * @param status 現在のステータス
 * @returns 遷移できるステータス
 */
export function nextStatuses(from: BookingStatus): BookingStatus[] {
  return BOOKING_TRANSITIONS[from];
}

/**
 * 終端かを判定する。
 *
 * @param status ステータス
 * @returns 終端なら true(完了・キャンセル・無断キャンセル)
 */
export function isFinalStatus(status: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[status].length === 0;
}

/**
 * 予約が枠を占有するかを判定する。
 *
 * **申請中も枠を占有する**(承認待ちの間に他の人に取られると、
 * 承認できなくなる)。キャンセル系は解放する。
 *
 * @param status ステータス
 * @returns 占有するなら true
 */
export function isActiveBooking(status: BookingStatus): boolean {
  return status === "requested" || status === "confirmed";
}
