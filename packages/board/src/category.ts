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

/**
 * フラットなカテゴリの配列をツリーにする。
 *
 * DB は親子を `parentId` で持つが、画面は入れ子で描く。その橋渡し。
 *
 * @param categories カテゴリの配列
 * @returns ツリー(**order 昇順、同順なら name 昇順**)。
 *   親が見つからないものはルート扱い(**データが壊れていても表示できる**ようにする)
 */
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

/**
 * slug からカテゴリを引く。
 *
 * @param categories カテゴリの配列
 * @param slug 探す slug
 * @returns カテゴリ。**見つからなければ undefined**
 */
export function findCategoryBySlug(categories: Category[], slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}

/**
 * あるカテゴリの子孫 ID をすべて集める(**自分を含む**)。
 *
 * 「親カテゴリを選んだら子カテゴリの記事も出す」ために使う。
 *
 * @param categories カテゴリの配列
 * @param rootId 起点のカテゴリ ID
 * @returns 子孫の ID(自分を含む)
 */
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

/**
 * カテゴリ(**子孫を含む**)で絞り込む。
 *
 * 親カテゴリを選ぶと、その下の記事もすべて出る(利用者の期待に沿う)。
 *
 * @param items 絞り込む対象(categoryId を持つもの)
 * @param categories カテゴリの配列
 * @param categoryId 選んだカテゴリ
 * @returns そのカテゴリと子孫に属する項目
 */
export function filterByCategory<T extends Categorized>(items: T[], categories: Category[], categoryId: string, options: { includeDescendants?: boolean } = {}): T[] {
  const ids = new Set(options.includeDescendants === false ? [categoryId] : descendantIds(categories, categoryId));
  return items.filter((it) => it.categoryId !== undefined && ids.has(it.categoryId));
}

/**
 * カテゴリ別の件数を集計する。
 *
 * @param items 集計する対象
 * @returns カテゴリ ID → 件数(**直属のみ**。子孫は含まない)
 */
export function countByCategory<T extends Categorized>(items: T[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const it of items) {
    if (it.categoryId !== undefined) counts[it.categoryId] = (counts[it.categoryId] ?? 0) + 1;
  }
  return counts;
}

/**
 * ルートから対象カテゴリまでのパンくずを作る。
 *
 * @param categories カテゴリの配列
 * @param categoryId 対象のカテゴリ
 * @returns `[ルート, …, 自分]` の配列。**見つからなければ空配列**
 */
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
