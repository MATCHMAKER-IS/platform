import { describe, it, expect } from "vitest";
import { findVariant, variantInStock, availableValues, priceRange, isAllSoldOut } from "./variant.js";
const variants = [
  { sku: "S-赤", options: { サイズ: "S", 色: "赤" }, price: 1000, stock: 5 },
  { sku: "M-赤", options: { サイズ: "M", 色: "赤" }, price: 1000, stock: 0 },
  { sku: "M-青", options: { サイズ: "M", 色: "青" }, price: 1200, stock: 3 },
  { sku: "L-青", options: { サイズ: "L", 色: "青" }, price: 1200, stock: 2 },
];
describe("variant", () => {
  it("finds and checks stock", () => {
    expect(findVariant(variants, { サイズ: "M", 色: "青" })!.sku).toBe("M-青");
    expect(variantInStock(variants[1]!)).toBe(false);
    expect(availableValues(variants, "サイズ", { 色: "青" }).sort()).toEqual(["L", "M"]);
    expect(availableValues(variants, "サイズ", { 色: "赤" })).toEqual(["S"]);
    expect(priceRange(variants)).toEqual({ min: 1000, max: 1200 });
    expect(isAllSoldOut(variants)).toBe(false);
  });
});
