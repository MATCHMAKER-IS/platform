/**
 * 監査ログの集計（監査ダッシュボード・ログイン監視）。操作種別・操作者ごとの件数や、ログイン成否を集計する。純粋な集計のみ。
 * @packageDocumentation
 */

/** 集計対象の行（監査ログの一部）。 */
export interface AuditLike {
  actor: string;
  action: string;
  at?: string;
}

/** 件数の 1 項目。 */
export interface Count {
  key: string;
  count: number;
}

function tally(rows: AuditLike[], keyOf: (r: AuditLike) => string): Count[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = keyOf(r);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => (b.count - a.count) || (a.key < b.key ? -1 : 1));
}

/** 監査ログの集計（総数・操作種別別・操作者別）。 */
export function summarizeAudit(rows: AuditLike[]): { total: number; byAction: Count[]; byActor: Count[] } {
  return { total: rows.length, byAction: tally(rows, (r) => r.action), byActor: tally(rows, (r) => r.actor) };
}

/** ログイン監視の集計（成功・失敗・イベント別）。失敗は action に fail/lock を含むもの。 */
export function summarizeLogins(rows: AuditLike[]): { total: number; success: number; failure: number; byEvent: Count[] } {
  const isFailure = (a: string) => /fail|lock|denied|invalid/i.test(a);
  const isSuccess = (a: string) => /login|success|signin/i.test(a) && !isFailure(a);
  return {
    total: rows.length,
    success: rows.filter((r) => isSuccess(r.action)).length,
    failure: rows.filter((r) => isFailure(r.action)).length,
    byEvent: tally(rows, (r) => r.action),
  };
}
