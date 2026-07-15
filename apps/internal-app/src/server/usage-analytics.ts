/**
 * 利用状況・設定変更の分析。監査ログから、設定変更の履歴抽出と、機能ごとの利用状況を集計する。純粋な集計のみ。
 * @packageDocumentation
 */

/** 集計対象の監査行。 */
export interface AuditLike {
  actor: string;
  action: string;
  target?: string;
  at?: string;
}

/** 設定変更とみなす操作（前方一致を含む）。 */
export const CONFIG_ACTIONS = ["settings.update", "features.update", "user.upsert", "user.setActive", "user.reissuePassword", "review.hide", "review.show", "broadcast.send"];

/** 監査ログから設定・管理系の変更のみを新しい順で抽出する。 */
export function configChanges(rows: AuditLike[]): AuditLike[] {
  return rows
    .filter((r) => CONFIG_ACTIONS.some((a) => r.action === a || r.action.startsWith(`${a}.`)))
    .slice()
    .sort((a, b) => ((b.at ?? "") < (a.at ?? "") ? -1 : (b.at ?? "") > (a.at ?? "") ? 1 : 0));
}

/** 件数の 1 項目。 */
export interface Count {
  key: string;
  count: number;
}

function tally(rows: AuditLike[], keyOf: (r: AuditLike) => string): Count[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = keyOf(r);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => (b.count - a.count) || (a.key < b.key ? -1 : 1));
}

/** 操作名から機能領域（先頭のドット前）を取り出す。 */
export function featureOf(action: string): string {
  const dot = action.indexOf(".");
  return dot >= 0 ? action.slice(0, dot) : action;
}

/** 利用状況の集計。 */
export interface UsageReport {
  totalEvents: number;
  activeUsers: number;
  byFeature: Count[];
  byActor: Count[];
  byAction: Count[];
}

/** 監査ログから利用状況（総イベント・アクティブ利用者・機能別/操作者別/操作別）を集計する。 */
export function featureUsage(rows: AuditLike[]): UsageReport {
  const actors = new Set(rows.map((r) => r.actor).filter(Boolean));
  return {
    totalEvents: rows.length,
    activeUsers: actors.size,
    byFeature: tally(rows, (r) => featureOf(r.action)),
    byActor: tally(rows, (r) => r.actor),
    byAction: tally(rows, (r) => r.action),
  };
}
