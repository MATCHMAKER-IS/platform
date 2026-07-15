/**
 * 予約ルール(純ロジック)。
 * 受付開始/締切(リードタイム)、予約可能期間、キャンセル期限、人数の妥当性を判定する。
 * @packageDocumentation
 */

/** 予約可能期間のルール。 */
export interface BookingWindow {
  /** 何分前まで予約可能か(直前予約の締切。例 60=1時間前まで)。 */
  minLeadMinutes?: number;
  /** 何日先まで予約可能か(例 30=30日先まで)。 */
  maxAdvanceDays?: number;
}

/** 判定結果。 */
export interface RuleCheck {
  ok: boolean;
  /** 不可のときの理由コード。 */
  reason?: "too_soon" | "too_far" | "past" | "too_few" | "too_many";
}

/** 予約日時が受付可能期間内か。 */
export function isWithinBookingWindow(bookingAt: string | Date, window: BookingWindow, now: Date = new Date()): RuleCheck {
  const target = typeof bookingAt === "string" ? new Date(bookingAt) : bookingAt;
  const diffMinutes = (target.getTime() - now.getTime()) / 60_000;
  if (diffMinutes < 0) return { ok: false, reason: "past" };
  if (window.minLeadMinutes !== undefined && diffMinutes < window.minLeadMinutes) return { ok: false, reason: "too_soon" };
  if (window.maxAdvanceDays !== undefined && diffMinutes > window.maxAdvanceDays * 24 * 60) return { ok: false, reason: "too_far" };
  return { ok: true };
}

/** キャンセル可能か(期限=開始の何分前まで)。 */
export function canCancel(bookingAt: string | Date, cancelDeadlineMinutes: number, now: Date = new Date()): boolean {
  const target = typeof bookingAt === "string" ? new Date(bookingAt) : bookingAt;
  const diffMinutes = (target.getTime() - now.getTime()) / 60_000;
  return diffMinutes >= cancelDeadlineMinutes;
}

/** 人数制約の判定。 */
export function validatePartySize(size: number, limits: { min?: number; max?: number }): RuleCheck {
  if (limits.min !== undefined && size < limits.min) return { ok: false, reason: "too_few" };
  if (limits.max !== undefined && size > limits.max) return { ok: false, reason: "too_many" };
  return { ok: true };
}

/** 理由コードの日本語メッセージ。 */
export const RULE_MESSAGES: Record<NonNullable<RuleCheck["reason"]>, string> = {
  too_soon: "予約受付の締切を過ぎています",
  too_far: "予約可能な期間より先の日時です",
  past: "過去の日時は予約できません",
  too_few: "人数が下限を下回っています",
  too_many: "人数が上限を超えています",
};
