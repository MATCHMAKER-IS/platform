/**
 * アクセス解析のイベントモデルと基本ユーティリティ。すべて純ロジック。
 * @packageDocumentation
 */

/** イベント種別。 */
export type AnalyticsEventType = "pageview" | "click" | "custom";

/** アクセスイベント。 */
export interface AnalyticsEvent {
  /** 種別。 */
  type: AnalyticsEventType;
  /** ページパス（例 "/pricing"）。 */
  path: string;
  /** セッションID（匿名の識別子）。 */
  sessionId: string;
  /** ログインユーザーID（任意）。 */
  userId?: string;
  /** 発生日時（ISO 8601）。 */
  at: string;
  /** 参照元（リファラのホスト等）。 */
  referrer?: string;
  /** カスタムイベント名（type=custom のとき）。 */
  name?: string;
  /** 任意の付加情報。 */
  meta?: Record<string, unknown>;
}

/** 期間で絞り込む（from/to は ISO、to は含む）。 */
export function withinPeriod(events: AnalyticsEvent[], from?: string, to?: string): AnalyticsEvent[] {
  return events.filter((e) => (!from || e.at >= from) && (!to || e.at <= to));
}

/** 種別で絞り込む。 */
export function ofType(events: AnalyticsEvent[], type: AnalyticsEventType): AnalyticsEvent[] {
  return events.filter((e) => e.type === type);
}
