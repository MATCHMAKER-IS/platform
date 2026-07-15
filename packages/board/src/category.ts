/**
 * ブログ/掲示板のカテゴリ機能（純関数）。階層カテゴリ・絞り込み・件数集計・パンくず。
 * @packageDocumentation
 */

/** カテゴリ（親を持てる階層構造）。 */
export interface Category {
  id: string;
  name: string;
  slug: string;
  /** 親カテゴリ ID（トップレベルは未指定）。 */
  parentId?: string;
  /** 表示順（小さい順）。 */
  order?: number;
}

/** カテゴリを持つ項目（記事など）。 */
export interface Categorized {
  categoryId?: string;
}

/** ツリー化したカテゴリ。 */
export interface CategoryNode extends Category {
  children: CategoryNode[];
}

/** フラットなカテゴリ配列をツリーにする（order 昇順、同順は name 昇順）。 */
export function categoryTree(categories: Category[]): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>();
  for (const c of categories) nodes.set(c.id, { ...c, children: [] });
  const roots: CategoryNode[] = [];
  for (const c of categories) {
    const node = nodes.get(c.id)!;
    if (c.parentId && nodes.has(c.parentId)) nodes.get(c.parentId)!.children.push(node);
    else roots.push(node);
  }
  const sortRec = (list: CategoryNode[]) => {
    list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const n of list) sortRec(n.children);
  };
  sortRec(roots);
  return roots;
}

/** slug からカテゴリを引く。 */
export function findCategoryBySlug(categories: Category[], slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}

/** あるカテゴリの子孫 ID をすべて集める（自分を含む）。 */
export function descendantIds(categories: Category[], categoryId: string): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const c of categories) {
    if (c.parentId) {
      const arr = childrenOf.get(c.parentId) ?? [];
      arr.push(c.id);
      childrenOf.set(c.parentId, arr);
    }
  }
  const result: string[] = [];
  const stack = [categoryId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    result.push(id);
    for (const child of childrenOf.get(id) ?? []) stack.push(child);
  }
  return result;
}

/** カテゴリ（子孫含む）で項目を絞り込む。 */
export function filterByCategory<T extends Categorized>(items: T[], categories: Category[], categoryId: string, options: { includeDescendants?: boolean } = {}): T[] {
  const ids = new Set(options.includeDescendants === false ? [categoryId] : descendantIds(categories, categoryId));
  return items.filter((it) => it.categoryId !== undefined && ids.has(it.categoryId));
}

/** カテゴリ別の件数を集計する。 */
export function countByCategory<T extends Categorized>(items: T[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const it of items) {
    if (it.categoryId !== undefined) counts[it.categoryId] = (counts[it.categoryId] ?? 0) + 1;
  }
  return counts;
}

/** ルートから対象カテゴリまでのパンくず（[親, …, 自分]）。 */
export function categoryPath(categories: Category[], categoryId: string): Category[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const path: Category[] = [];
  let current = byId.get(categoryId);
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}
