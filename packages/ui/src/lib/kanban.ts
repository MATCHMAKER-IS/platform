/**
 * カンバンの純ロジック(カードの移動・並べ替え)。UI から分離してテスト可能にする。
 * @packageDocumentation
 */
export interface KanbanCardLike { id: string }
export interface KanbanColumnLike<C extends KanbanCardLike = KanbanCardLike> { id: string; cards: C[] }

/**
 * カードを別カラム(または同カラム内の位置)へ移動した新しいカラム配列を返す(不変更新)。
 * @param columns 現在のカラム
 * @param cardId 動かすカード
 * @param toColumnId 移動先カラム
 * @param toIndex 移動先の挿入位置(省略時は末尾)
 * @returns 移動後の**新しい配列**(元は変更しない)
 */
export function moveCard<C extends KanbanCardLike>(
  columns: KanbanColumnLike<C>[],
  cardId: string,
  toColumnId: string,
  toIndex?: number,
): KanbanColumnLike<C>[] {
  let moved: C | undefined;
  // まず取り出す
  const removed = columns.map((col) => {
    const idx = col.cards.findIndex((c) => c.id === cardId);
    if (idx === -1) return col;
    moved = col.cards[idx];
    return { ...col, cards: col.cards.filter((c) => c.id !== cardId) };
  });
  if (!moved) return columns; // 見つからなければ不変
  // 挿入する
  return removed.map((col) => {
    if (col.id !== toColumnId) return col;
    const cards = [...col.cards];
    const at = toIndex === undefined || toIndex < 0 || toIndex > cards.length ? cards.length : toIndex;
    cards.splice(at, 0, moved!);
    return { ...col, cards };
  });
}

/**
 * カラムごとの枚数を数える。
 *
 *
 * @param cards カードの配列
 * @returns 列ごとの件数(**WIP 制限の判定に使う**)
 */
export function countByColumn(columns: KanbanColumnLike[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const col of columns) out[col.id] = col.cards.length;
  return out;
}
