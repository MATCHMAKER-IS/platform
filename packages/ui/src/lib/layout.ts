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

/** span を [min,max] に丸める。 */
export function clampSpan(span: number, min = 1, max = 12): number {
  return Math.max(min, Math.min(max, Math.round(span)));
}

/** fromId を toId の位置へ移動した新しい配列を返す。 */
export function reorder(list: DashboardLayout, fromId: string, toId: string): DashboardLayout {
  const from = list.findIndex((i) => i.id === fromId);
  const to = list.findIndex((i) => i.id === toId);
  if (from < 0 || to < 0 || from === to) return list;
  const copy = [...list];
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved!);
  return copy;
}

/** ピクセル幅からカラム数を求める(リサイズ用)。 */
export function pxToColSpan(widthPx: number, containerPx: number, columns: number): number {
  if (containerPx <= 0) return 1;
  return clampSpan((widthPx / containerPx) * columns, 1, columns);
}

/** 指定 id の colSpan を更新した新しい配列を返す。 */
export function setColSpan(list: DashboardLayout, id: string, colSpan: number, columns = 12): DashboardLayout {
  return list.map((i) => (i.id === id ? { ...i, colSpan: clampSpan(colSpan, 1, columns) } : i));
}
