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

/**
 * 予約日時が受付可能な期間内かを判定する。
 *
 * **直前すぎる予約と、先すぎる予約を弾く**(30 分後の予約は準備できない、
 * 1 年先の予約は営業時間が変わるかもしれない)。
 *
 * @param bookingAt 予約日時
 * @param rules 最短・最長のリードタイム
 * @param now 現在時刻(テスト注入用)
 * @returns 受付できれば true
 */
export function isWithinBookingWindow(bookingAt: string | Date, window: BookingWindow, now: Date = new Date()): RuleCheck {
  const target = typeof bookingAt === "string" ? new Date(bookingAt) : bookingAt;
  const diffMinutes = (target.getTime() - now.getTime()) / 60_000;
  if (diffMinutes < 0) return { ok: false, reason: "past" };
  if (window.minLeadMinutes !== undefined && diffMinutes < window.minLeadMinutes) return { ok: false, reason: "too_soon" };
  if (window.maxAdvanceDays !== undefined && diffMinutes > window.maxAdvanceDays * 24 * 60) return { ok: false, reason: "too_far" };
  return { ok: true };
}

/**
 * キャンセルできるかを判定する。
 *
 * **期限を過ぎたらキャンセル料がかかる**運用が多い(この関数は可否だけを返す。
 * 料金の計算はアプリ側)。
 *
 * @param bookingAt 予約日時
 * @param deadlineMinutes 開始の何分前まで
 * @param now 現在時刻(テスト注入用)
 * @returns キャンセルできれば true
 */
export function canCancel(bookingAt: string | Date, cancelDeadlineMinutes: number, now: Date = new Date()): boolean {
  const target = typeof bookingAt === "string" ? new Date(bookingAt) : bookingAt;
  const diffMinutes = (target.getTime() - now.getTime()) / 60_000;
  return diffMinutes >= cancelDeadlineMinutes;
}

/**
 * 人数が制約を満たすかを判定する。
 *
 * @param partySize 人数
 * @param rules 最小・最大
 * @returns 満たせば true
 */
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
