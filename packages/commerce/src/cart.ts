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

/** 空のカート。 */
export function emptyCart(): Cart {
  return { items: [] };
}

/** カート内の該当明細を返す。 */
export function findCartItem(cart: Cart, productId: string): CartItem | undefined {
  return cart.items.find((i) => i.productId === productId);
}

/**
 * 商品を追加する。既にあれば数量を加算、無ければ明細追加。
 * @param item 追加する明細(quantity 既定 1)
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

/** 数量を設定する(0 以下は明細ごと削除)。 */
export function setQuantity(cart: Cart, productId: string, quantity: number): Cart {
  if (quantity <= 0) return removeFromCart(cart, productId);
  return { items: cart.items.map((i) => (i.productId === productId ? { ...i, quantity } : i)) };
}

/** 数量を増やす。 */
export function incrementQuantity(cart: Cart, productId: string, by = 1): Cart {
  const item = findCartItem(cart, productId);
  return item ? setQuantity(cart, productId, item.quantity + by) : cart;
}

/** 数量を減らす(0 以下になれば削除)。 */
export function decrementQuantity(cart: Cart, productId: string, by = 1): Cart {
  const item = findCartItem(cart, productId);
  return item ? setQuantity(cart, productId, item.quantity - by) : cart;
}

/** 明細を削除する。 */
export function removeFromCart(cart: Cart, productId: string): Cart {
  return { items: cart.items.filter((i) => i.productId !== productId) };
}

/** カートを空にする。 */
export function clearCart(): Cart {
  return emptyCart();
}

/** 明細の小計(単価 × 数量)。 */
export function lineTotal(item: CartItem): number {
  return item.unitPrice * item.quantity;
}

/** カート小計(全明細の合計)。 */
export function cartSubtotal(cart: Cart): number {
  return cart.items.reduce((sum, i) => sum + lineTotal(i), 0);
}

/** 総点数(数量の合計)。 */
export function cartItemCount(cart: Cart): number {
  return cart.items.reduce((sum, i) => sum + i.quantity, 0);
}

/** 商品種類数(明細数)。 */
export function cartUniqueCount(cart: Cart): number {
  return cart.items.length;
}

/** カートが空か。 */
export function isCartEmpty(cart: Cart): boolean {
  return cart.items.length === 0;
}

/**
 * 2 つのカートを統合する(ゲストカート + ログイン後のカートなど)。
 * 同一商品は数量を加算する。base の並び順を保ち、base に無い商品を追加。
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
