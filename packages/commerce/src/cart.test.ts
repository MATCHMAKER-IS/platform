import { describe, it, expect } from "vitest";
import { emptyCart, addToCart, setQuantity, decrementQuantity, removeFromCart, findCartItem, cartSubtotal, cartItemCount, cartUniqueCount, lineTotal, mergeCarts } from "./cart.js";
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
