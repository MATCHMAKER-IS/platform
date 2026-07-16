/**
 * ダッシュボードレイアウトの純ロジック(並べ替え・カラム幅計算)。
 * @packageDocumentation
 */

/** 1 ウィジェットのレイアウト。 */
export interface LayoutItem {
  id: string;
  /** 占有カラム数。 */
  colSpan: number;
}

/** ダッシュボード全体のレイアウト(表示順)。 */
export type DashboardLayout = LayoutItem[];

/**
 * span を範囲に丸める。
 *
 * @param span 列数
 * @param min / max 範囲
 * @returns 丸めた値
 */
export function clampSpan(span: number, min = 1, max = 12): number {
  return Math.max(min, Math.min(max, Math.round(span)));
}

/**
 * ウィジェットを移動する(ドラッグ&ドロップ)。
 *
 * @param items 現在の配置
 * @param fromId 移動するウィジェット
 * @param toId 移動先の位置
 * @returns 移動後の**新しい配列**(元は変更しない)
 */
export function reorder(list: DashboardLayout, fromId: string, toId: string): DashboardLayout {
  const from = list.findIndex((i) => i.id === fromId);
  const to = list.findIndex((i) => i.id === toId);
  if (from < 0 || to < 0 || from === to) return list;
  const copy = [...list];
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved!);
  return copy;
}

/**
 * 幅からカラム数を求める(レスポンシブ)。
 *
 * **画面幅で段数を変える**(スマホは 1 列、デスクトップは 4 列など)。
 *
 * @param width ピクセル幅
 * @param breakpoints ブレークポイント
 * @returns カラム数
 */
export function pxToColSpan(widthPx: number, containerPx: number, columns: number): number {
  if (containerPx <= 0) return 1;
  return clampSpan((widthPx / containerPx) * columns, 1, columns);
}

/**
 * ウィジェットの幅を変更する。
 *
 * @param items 現在の配置
 * @param id 対象のウィジェット
 * @param colSpan 新しい列数
 * @returns 更新した新しい配列
 */
export function setColSpan(list: DashboardLayout, id: string, colSpan: number, columns = 12): DashboardLayout {
  return list.map((i) => (i.id === id ? { ...i, colSpan: clampSpan(colSpan, 1, columns) } : i));
}
