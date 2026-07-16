/**
 * アクセスイベントの集計（純関数）。ページビュー・ユニークビジター・人気ページ・時系列など。
 * @packageDocumentation
 */
import { ofType, type AnalyticsEvent } from "./event.js";

/**
 * 総ページビュー数を返す。
 *
 * @param events イベントの配列
 * @returns ページビューの件数
 */
export function pageViews(events: AnalyticsEvent[]): number {
  return ofType(events, "pageview").length;
}

/**
 * ユニークビジター数を返す(**セッション ID のユニーク数**)。
 *
 * **同じ人が別の日に来れば別カウント**(セッションが変わるため)。
 * 「何人が来たか」ではなく「何回の訪問があったか」に近い。
 *
 * @param events イベントの配列
 * @returns ユニークなセッション数
 */
export function uniqueVisitors(events: AnalyticsEvent[]): number {
  return new Set(events.map((e) => e.sessionId)).size;
}

/**
 * ログインユーザーのユニーク数を返す。
 *
 * **こちらは本当の「人数」**(userId で数えるため、別の日でも同じ人は 1)。
 *
 * @param events イベントの配列
 * @returns ユニークなユーザー数
 */
export function uniqueUsers(events: AnalyticsEvent[]): number {
  return new Set(events.filter((e) => e.userId).map((e) => e.userId)).size;
}

/** ページ別の集計項目。 */
export interface PageStat {
  path: string;
  views: number;
  visitors: number;
}

/**
 * 人気ページの上位を返す。
 *
 * @param events イベントの配列
 * @param limit 件数(既定 10)
 * @returns パスとビュー数(**多い順**。同数ならパスの昇順で安定させる)
 */
export function topPages(events: AnalyticsEvent[], limit = 10): PageStat[] {
  const byPath = new Map<string, { views: number; sessions: Set<string> }>();
  for (const e of ofType(events, "pageview")) {
    const cur = byPath.get(e.path) ?? { views: 0, sessions: new Set<string>() };
    cur.views += 1;
    cur.sessions.add(e.sessionId);
    byPath.set(e.path, cur);
  }
  return [...byPath.entries()]
    .map(([path, v]) => ({ path, views: v.views, visitors: v.sessions.size }))
    .sort((a, b) => (b.views - a.views) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .slice(0, limit);
}

/** 参照元別の集計項目。 */
export interface ReferrerStat {
  referrer: string;
  count: number;
}

/**
 * 参照元の内訳を返す。
 *
 * @param events イベントの配列
 * @returns 参照元と件数(多い順)。**referrer が無いものは `direct`**(直接アクセス)
 */
export function referrerBreakdown(events: AnalyticsEvent[], limit = 10): ReferrerStat[] {
  const byRef = new Map<string, number>();
  for (const e of ofType(events, "pageview")) {
    const ref = e.referrer && e.referrer.length > 0 ? e.referrer : "direct";
    byRef.set(ref, (byRef.get(ref) ?? 0) + 1);
  }
  return [...byRef.entries()]
    .map(([referrer, count]) => ({ referrer, count }))
    .sort((a, b) => (b.count - a.count) || (a.referrer < b.referrer ? -1 : 1))
    .slice(0, limit);
}

/** 時系列のバケット単位。 */
export type Bucket = "hour" | "day";

/** 時系列の 1 点。 */
export interface TimePoint {
  /** バケットの開始（ISO・day は YYYY-MM-DD、hour は YYYY-MM-DDTHH:00）。 */
  bucket: string;
  views: number;
  visitors: number;
}

function bucketKey(at: string, bucket: Bucket): string {
  // at は ISO。day は先頭10文字、hour は先頭13文字 + ":00"。
  return bucket === "day" ? at.slice(0, 10) : `${at.slice(0, 13)}:00`;
}

/**
 * ページビューを時系列に集計する。
 *
 * @param events イベントの配列
 * @param bucket 集計の単位(`hour` / `day` / `month`)
 * @returns 時刻と件数(**昇順**。グラフにそのまま渡せる)
 */
export function timeSeries(events: AnalyticsEvent[], bucket: Bucket = "day"): TimePoint[] {
  const byBucket = new Map<string, { views: number; sessions: Set<string> }>();
  for (const e of ofType(events, "pageview")) {
    const key = bucketKey(e.at, bucket);
    const cur = byBucket.get(key) ?? { views: 0, sessions: new Set<string>() };
    cur.views += 1;
    cur.sessions.add(e.sessionId);
    byBucket.set(key, cur);
  }
  return [...byBucket.entries()]
    .map(([b, v]) => ({ bucket: b, views: v.views, visitors: v.sessions.size }))
    .sort((a, b) => (a.bucket < b.bucket ? -1 : a.bucket > b.bucket ? 1 : 0));
}

/**
 * セッションごとのページビュー数から直帰率（1 ページのみのセッション割合）を出す。
 *
 * @param events イベントの配列
 * @returns 0〜1(**1 ページだけ見て離脱したセッションの比率**)。セッションが 0 なら 0
 */
export function bounceRate(events: AnalyticsEvent[]): number {
  const bySession = new Map<string, number>();
  for (const e of ofType(events, "pageview")) {
    bySession.set(e.sessionId, (bySession.get(e.sessionId) ?? 0) + 1);
  }
  const total = bySession.size;
  if (total === 0) return 0;
  let bounced = 0;
  for (const count of bySession.values()) if (count === 1) bounced += 1;
  return bounced / total;
}

/** 概況サマリー。 */
export interface AnalyticsSummary {
  pageViews: number;
  uniqueVisitors: number;
  uniqueUsers: number;
  bounceRate: number;
  topPages: PageStat[];
  referrers: ReferrerStat[];
}

/**
 * 概況をまとめて計算する。
 *
 * @param events イベントの配列
 * @returns PV・UU・ユーザー数・直帰率・人気ページ・参照元(ダッシュボード用)
 */
export function summarize(events: AnalyticsEvent[], options: { topN?: number } = {}): AnalyticsSummary {
  const topN = options.topN ?? 5;
  return {
    pageViews: pageViews(events),
    uniqueVisitors: uniqueVisitors(events),
    uniqueUsers: uniqueUsers(events),
    bounceRate: bounceRate(events),
    topPages: topPages(events, topN),
    referrers: referrerBreakdown(events, topN),
  };
}
