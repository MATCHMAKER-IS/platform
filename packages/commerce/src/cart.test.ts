import { describe, it, expect } from "vitest";
import { emptyCart, addToCart, setQuantity, findCartItem, cartSubtotal, cartItemCount, cartUniqueCount, lineTotal, mergeCarts, normalizeQuantity, MAX_CART_QUANTITY } from "./cart";
describe("cart", () => {
  it("adds, updates, removes", () => {
    let c = addToCart(addToCart(emptyCart(), { productId: "A", name: "A", unitPrice: 1000 }), { productId: "B", name: "B", unitPrice: 500, quantity: 2 });
    expect(cartUniqueCount(c)).toBe(2);
    expect(cartItemCount(c)).toBe(3);
    expect(cartSubtotal(c)).toBe(2000);
    c = addToCart(c, { productId: "A", name: "A", unitPrice: 1000 });
    expect(findCartItem(c, "A")!.quantity).toBe(2);
    c = setQuantity(c, "A", 0);
    expect(findCartItem(c, "A")).toBeUndefined();
    expect(lineTotal({ productId: "x", name: "x", unitPrice: 300, quantity: 4 })).toBe(1200);
  });
  it("merges guest and user carts", () => {
    const guest = { items: [{ productId: "A", name: "A", unitPrice: 1000, quantity: 1 }, { productId: "C", name: "C", unitPrice: 200, quantity: 1 }] };
    const user = { items: [{ productId: "A", name: "A", unitPrice: 1000, quantity: 2 }] };
    const m = mergeCarts(user, guest);
    expect(findCartItem(m, "A")!.quantity).toBe(3);
    expect(cartUniqueCount(m)).toBe(2);
  });
});

describe("数量は整数・上限つき", () => {
  const one = () => addToCart(emptyCart(), { productId: "p1", name: "商品", unitPrice: 100, quantity: 1 });

  // **小数は在庫の引き当てと合わない。** 画面から送れるなら
  // そのまま注文が成立する(2026-08 に対処)
  it("小数は切り捨てる", () => {
    expect(setQuantity(one(), "p1", 1.9).items[0]?.quantity).toBe(1);
  });
  // **上限が無いと 10 億個の注文が与信や決済まで進む**
  it("上限を超えたら丸める", () => {
    expect(setQuantity(one(), "p1", 1e9).items[0]?.quantity).toBe(MAX_CART_QUANTITY);
  });
  // **何度も追加すれば超えられては意味がない**
  it("加算した結果も上限に収める", () => {
    let c = addToCart(emptyCart(), { productId: "p1", name: "x", unitPrice: 100, quantity: 5000 });
    c = addToCart(c, { productId: "p1", name: "x", unitPrice: 100, quantity: 8000 });
    expect(c.items[0]?.quantity).toBe(MAX_CART_QUANTITY);
  });
  // **正常な値は変えない**(境界)
  it("正常な整数はそのまま", () => {
    expect(normalizeQuantity(3)).toBe(3);
    expect(normalizeQuantity(MAX_CART_QUANTITY)).toBe(MAX_CART_QUANTITY);
  });
  // **不正な値は 0**(NaN・Infinity・負数)
  it("不正な値は 0", () => {
    expect(normalizeQuantity(Number.NaN)).toBe(0);
    expect(normalizeQuantity(Number.POSITIVE_INFINITY)).toBe(0);
    expect(normalizeQuantity(-1)).toBe(0);
  });
});
