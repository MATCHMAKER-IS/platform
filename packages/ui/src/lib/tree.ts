/**
 * ツリーの純ロジック(展開集合の操作・探索)。UI から分離してテスト可能にする。
 * @packageDocumentation
 */
export interface TreeNodeLike { id: string; children?: TreeNodeLike[] }

/** 展開集合に対して 1 件トグルした新しい集合を返す。 */
export function toggleExpanded(expanded: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(expanded);
  if (next.has(id)) next.delete(id); else next.add(id);
  return next;
}

/** 全ノードの ID を集める(全展開用)。 */
export function collectAllIds(nodes: TreeNodeLike[]): string[] {
  const ids: string[] = [];
  const walk = (ns: TreeNodeLike[]) => { for (const n of ns) { ids.push(n.id); if (n.children?.length) walk(n.children); } };
  walk(nodes);
  return ids;
}

/** ID からノードを探す(深さ優先)。 */
export function findNode<T extends TreeNodeLike>(nodes: T[], id: string): T | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children?.length) { const f = findNode(n.children as T[], id); if (f) return f; }
  }
  return undefined;
}

/** 指定ノードへの祖先 ID パスを返す(自動展開用)。 */
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
