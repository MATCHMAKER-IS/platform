/**
 * ショッピングカート(純ロジック)。
 * 商品の追加・数量変更・削除と、小計・点数の集計、ゲスト↔ログインのカート統合を行う。
 * 保存(DB/セッション)はアプリ側。ここは状態を受け取り新しい状態を返す不変操作のみ。
 * @packageDocumentation
 */

/** カート内の 1 明細。 */
export interface CartItem {
  /** 商品 ID(同一商品の判定キー)。 */
  productId: string;
  /** 商品名。 */
  name: string;
  /** 単価(円)。税の扱いは注文サマリで指定。 */
  unitPrice: number;
  /** 数量。 */
  quantity: number;
  /** 追加の任意情報(SKU・オプション・画像 URL など)。 */
  [key: string]: unknown;
}

/** カート。 */
export interface Cart {
  items: CartItem[];
}

/** カート追加時の入力(quantity は任意・省略時 1)。 */
export interface AddToCartInput {
  productId: string;
  name: string;
  unitPrice: number;
  quantity?: number;
  /** 追加の任意情報。 */
  [key: string]: unknown;
}

/**
 * 空のカートを作る。
 *
 * @returns 空のカート
 */
export function emptyCart(): Cart {
  return { items: [] };
}

/**
 * カート内の明細を探す。
 *
 * @param cart カート
 * @param variantId 商品バリアント
 * @returns 明細。**無ければ undefined**
 */
export function findCartItem(cart: Cart, productId: string): CartItem | undefined {
  return cart.items.find((i) => i.productId === productId);
}

/**
 * 商品を追加する。既にあれば数量を加算、無ければ明細追加。
 * @param item 追加する明細(quantity 既定 1)
 * @returns 更新した新しいカート(**同じ商品なら数量を足す**。明細を増やさない)
 */
export function addToCart(cart: Cart, item: AddToCartInput): Cart {
  const qty = item.quantity ?? 1;
  if (qty <= 0) return cart;
  const existing = findCartItem(cart, item.productId);
  if (existing) {
    return {
      items: cart.items.map((i) => (i.productId === item.productId ? { ...i, quantity: i.quantity + qty } : i)),
    };
  }
  const newItem: CartItem = { ...item, quantity: qty };
  return { items: [...cart.items, newItem] };
}

/**
 * 数量を設定する。
 *
 * **0 以下なら明細ごと削除**(「0 個」の明細を残さない)。
 *
 * @param cart カート
 * @param variantId 商品バリアント
 * @param quantity 数量
 * @returns 更新した**新しいカート**(元は変更しない)
 */
export function setQuantity(cart: Cart, productId: string, quantity: number): Cart {
  if (quantity <= 0) return removeFromCart(cart, productId);
  return { items: cart.items.map((i) => (i.productId === productId ? { ...i, quantity } : i)) };
}

/**
 * 数量を増やす。
 *
 * @param cart カート
 * @param variantId 商品バリアント
 * @param delta 増やす数(既定 1)
 * @returns 更新した新しいカート
 */
export function incrementQuantity(cart: Cart, productId: string, by = 1): Cart {
  const item = findCartItem(cart, productId);
  return item ? setQuantity(cart, productId, item.quantity + by) : cart;
}

/**
 * 数量を減らす。
 *
 * **0 以下になれば削除**。
 *
 * @param cart カート
 * @param variantId 商品バリアント
 * @param delta 減らす数(既定 1)
 * @returns 更新した新しいカート
 */
export function decrementQuantity(cart: Cart, productId: string, by = 1): Cart {
  const item = findCartItem(cart, productId);
  return item ? setQuantity(cart, productId, item.quantity - by) : cart;
}

/**
 * 明細を削除する。
 *
 * @param cart カート
 * @param variantId 商品バリアント
 * @returns 更新した新しいカート
 */
export function removeFromCart(cart: Cart, productId: string): Cart {
  return { items: cart.items.filter((i) => i.productId !== productId) };
}

/**
 * カートを空にする。
 *
 * @param cart カート
 * @returns 空のカート
 */
export function clearCart(): Cart {
  return emptyCart();
}

/**
 * 明細の小計を返す(単価 × 数量)。
 *
 * @param item 明細
 * @returns 小計
 */
export function lineTotal(item: CartItem): number {
  return item.unitPrice * item.quantity;
}

/**
 * カートの小計を返す。
 *
 * **税・送料は含まない**(それらは注文時に確定する。カートの時点では
 * 配送先が決まっておらず、送料を出せない)。
 *
 * @param cart カート
 * @returns 小計
 */
export function cartSubtotal(cart: Cart): number {
  return cart.items.reduce((sum, i) => sum + lineTotal(i), 0);
}

/**
 * 総点数を返す(数量の合計)。
 *
 * @param cart カート
 * @returns 点数(**バッジに出す数**)
 */
export function cartItemCount(cart: Cart): number {
  return cart.items.reduce((sum, i) => sum + i.quantity, 0);
}

/**
 * 商品の種類数を返す(明細数)。
 *
 * **総点数とは違う**(同じ商品を 3 個なら、種類は 1・点数は 3)。
 *
 * @param cart カート
 * @returns 種類数
 */
export function cartUniqueCount(cart: Cart): number {
  return cart.items.length;
}

/**
 * カートが空かを判定する。
 *
 * @param cart カート
 * @returns 空なら true
 */
export function isCartEmpty(cart: Cart): boolean {
  return cart.items.length === 0;
}

/**
 * 2 つのカートを統合する(ゲストカート + ログイン後のカートなど)。
 * 同一商品は数量を加算する。base の並び順を保ち、base に無い商品を追加。
 *
 * @param guest 未ログイン時のカート
 * @param user ログイン後のカート
 * @returns 統合したカート(**ログイン時に使う**。同じ商品は数量を合算)
 */
export function mergeCarts(base: Cart, incoming: Cart): Cart {
  let result = base;
  for (const item of incoming.items) {
    const existing = findCartItem(result, item.productId);
    result = existing
      ? setQuantity(result, item.productId, existing.quantity + item.quantity)
      : { items: [...result.items, item] };
  }
  return result;
}
