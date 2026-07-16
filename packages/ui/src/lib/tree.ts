/**
 * ツリーの純ロジック(展開集合の操作・探索)。UI から分離してテスト可能にする。
 * @packageDocumentation
 */
export interface TreeNodeLike { id: string; children?: TreeNodeLike[] }

/**
 * ノードの展開を切り替える。
 *
 * @param expanded 展開中の ID
 * @param id 切り替える ID
 * @returns 更新した**新しい集合**(元は変更しない)
 */
export function toggleExpanded(expanded: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(expanded);
  if (next.has(id)) next.delete(id); else next.add(id);
  return next;
}

/**
 * すべてのノード ID を集める(全展開用)。
 *
 * @param nodes ツリー
 * @returns すべての ID
 */
export function collectAllIds(nodes: TreeNodeLike[]): string[] {
  const ids: string[] = [];
  const walk = (ns: TreeNodeLike[]) => { for (const n of ns) { ids.push(n.id); if (n.children?.length) walk(n.children); } };
  walk(nodes);
  return ids;
}

/**
 * ノードを ID で探す(深さ優先)。
 *
 * @param nodes ツリー
 * @param id 探す ID
 * @returns ノード。**見つからなければ undefined**
 */
export function findNode<T extends TreeNodeLike>(nodes: T[], id: string): T | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children?.length) { const f = findNode(n.children as T[], id); if (f) return f; }
  }
  return undefined;
}

/**
 * ノードへの祖先パスを返す(自動展開用)。
 *
 * **検索結果を選んだとき、その親をすべて開く**のに使う
 * (深い階層のノードが、畳まれたまま「選択中」では意味がない)。
 *
 * @param nodes ツリー
 * @param id 対象のノード
 * @returns 祖先の ID(**根から順**)。見つからなければ空配列
 */
export function pathToNode(nodes: TreeNodeLike[], id: string): string[] {
  const path: string[] = [];
  const walk = (ns: TreeNodeLike[], acc: string[]): boolean => {
    for (const n of ns) {
      const cur = [...acc, n.id];
      if (n.id === id) { path.push(...cur); return true; }
      if (n.children?.length && walk(n.children, cur)) return true;
    }
    return false;
  };
  walk(nodes, []);
  return path;
}
