/**
 * 経営ダッシュボードの KPI 集計（アプリ側の組み合わせ）。
 * 売掛・買掛・在庫・勤怠承認の各サマリーを 1 つの指標に束ねる。純粋な組み立てのみ。
 * @packageDocumentation
 */

/** ダッシュボードの入力。 */
export interface KpiInput {
  /** 売掛: 未収合計と、期限超過分（当日以前）の合計。 */
  receivables: { outstanding: number; overdue: number };
  /** 買掛: 未払合計と、期限超過分の合計。 */
  payables: { outstanding: number; overdue: number };
  /** 在庫: 発注点を割った品目数。 */
  reorderCount: number;
  /** 勤怠: 承認待ちの申請件数。 */
  pendingApprovals: number;
  /** 請求: 期限超過の請求書件数。 */
  overdueInvoices: number;
}

/** ダッシュボードの KPI。 */
export interface DashboardKpi extends KpiInput {
  /** 運転資本の目安（売掛未収 − 買掛未払）。 */
  workingCapital: number;
  /** 対応が必要な事項の総数（発注要 + 承認待ち + 期限超過請求）。 */
  actionItems: number;
}

/** 各サマリーを 1 つの KPI に束ねる。 */
export function buildKpi(input: KpiInput): DashboardKpi {
  return {
    ...input,
    workingCapital: input.receivables.outstanding - input.payables.outstanding,
    actionItems: input.reorderCount + input.pendingApprovals + input.overdueInvoices,
  };
}

/** エイジングの期限超過分（当日以前）= total − current。 */
export function overdueFromAging(aging: { total: number; current: number }): number {
  return aging.total - aging.current;
}
