/**
 * お気に入り(ウィッシュリスト)と最近見た商品(純ロジック)。
 * 商品 ID の集合として扱う。保存はアプリ側。
 * @packageDocumentation
 */

/** お気に入り(商品 ID の集合)。 */
export type Favorites = ReadonlySet<string>;

/**
 * 空のお気に入りを作る。
 *
 * @returns 空のお気に入り
 */
export function emptyFavorites(): Favorites {
  return new Set<string>();
}

/**
 * お気に入りに追加する。
 *
 * @param favorites 現在のお気に入り
 * @param productId 商品
 * @returns 更新した**新しいお気に入り**(**既にあれば変わらない**)
 */
export function addFavorite(favorites: Favorites, productId: string): Favorites {
  const next = new Set(favorites);
  next.add(productId);
  return next;
}

/**
 * お気に入りから外す。
 *
 * @param favorites 現在のお気に入り
 * @param productId 商品
 * @returns 更新した新しいお気に入り
 */
export function removeFavorite(favorites: Favorites, productId: string): Favorites {
  const next = new Set(favorites);
  next.delete(productId);
  return next;
}

/**
 * お気に入りを切り替える。
 *
 * **ハートのボタン**に使う(押すたびに付け外し)。
 *
 * @param favorites 現在のお気に入り
 * @param productId 商品
 * @returns 更新した新しいお気に入り
 */
export function toggleFavorite(favorites: Favorites, productId: string): Favorites {
  return favorites.has(productId) ? removeFavorite(favorites, productId) : addFavorite(favorites, productId);
}

/**
 * お気に入り登録済みかを判定する。
 *
 * @param favorites お気に入り
 * @param productId 商品
 * @returns 登録済みなら true
 */
export function isFavorite(favorites: Favorites, productId: string): boolean {
  return favorites.has(productId);
}

/**
 * お気に入りの件数を返す。
 *
 * @param favorites お気に入り
 * @returns 件数
 */
export function favoriteCount(favorites: Favorites): number {
  return favorites.size;
}

/**
 * お気に入りの商品 ID を返す。
 *
 * @param favorites お気に入り
 * @returns 商品 ID の配列(**追加順**)
 */
export function favoriteIds(favorites: Favorites): string[] {
  return [...favorites];
}

/**
 * 最近見た商品リストに追加する(先頭に入れ、重複を除き、最大件数で切る)。
 * @param recent 現在のリスト(新しい順)
 * @param max 保持する最大件数(既定 20)
 * @returns 更新した履歴(**既にあれば先頭に移動**。重複させない)
 */
export function pushRecentlyViewed(recent: string[], productId: string, max = 20): string[] {
  return [productId, ...recent.filter((id) => id !== productId)].slice(0, max);
}
