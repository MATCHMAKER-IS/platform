import { describe, it, expect } from "vitest";
import { isActive, activeTrail, breadcrumbFromMenu, flattenMenu } from "./navigation.js";
const menu = [
  { label: "ホーム", href: "/" },
  { label: "製品", href: "/products", children: [{ label: "製品A", href: "/products/a" }, { label: "製品B", href: "/products/b" }] },
  { label: "会社概要", href: "/about" },
];
describe("navigation", () => {
  it("detects active and trail", () => {
    expect(isActive(menu[1]!, "/products/a")).toBe(true);
    expect(isActive(menu[1]!, "/products", { exact: true })).toBe(true);
    expect(isActive(menu[0]!, "/about")).toBe(false);
    expect(activeTrail(menu, "/products/a").map((i) => i.label)).toEqual(["製品", "製品A"]);
    expect(breadcrumbFromMenu(menu, "/products/b")).toEqual([{ label: "製品", href: "/products" }, { label: "製品B", href: "/products/b" }]);
    expect(flattenMenu(menu)).toHaveLength(5);
  });
});

import { breadcrumbFromPath } from "./navigation.js";
describe("breadcrumbFromPath", () => {
  it("builds breadcrumbs from a path", () => {
    expect(breadcrumbFromPath("/products/a")).toEqual([{ label: "ホーム", href: "/" }, { label: "Products", href: "/products" }, { label: "A", href: "/products/a" }]);
    expect(breadcrumbFromPath("/products/a", { labels: { products: "製品", "/products/a": "製品A" } })).toEqual([{ label: "ホーム", href: "/" }, { label: "製品", href: "/products" }, { label: "製品A", href: "/products/a" }]);
    expect(breadcrumbFromPath("/a", { home: false })).toHaveLength(1);
    expect(breadcrumbFromPath("/products/a", { includeCurrent: false }).map((i) => i.href)).toEqual(["/", "/products"]);
    expect(breadcrumbFromPath("/user-settings")[1]!.label).toBe("User Settings");
    expect(breadcrumbFromPath("/")).toEqual([{ label: "ホーム", href: "/" }]);
  });
});
