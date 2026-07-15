import { describe, it, expect } from "vitest";
import { isNavActive, findActiveNav, flattenNav, hasActiveChild, filterNavByPermission, type NavItem } from "./nav.js";
const items: NavItem[] = [
  { label: "ホーム", href: "/" },
  { label: "製品", href: "/products", children: [{ label: "製品A", href: "/products/a" }] },
  { label: "会社", href: "/about" },
];
describe("ui nav lib", () => {
  it("detects active state", () => {
    expect(isNavActive("/products", "/products/a")).toBe(true);
    expect(isNavActive("/products", "/products", true)).toBe(true);
    expect(isNavActive("/products", "/products/a", true)).toBe(false);
    expect(isNavActive("/", "/about")).toBe(false);
    expect(isNavActive("/products", "/products/?x=1")).toBe(true);
  });
  it("flattens and finds active", () => {
    expect(flattenNav(items)).toHaveLength(4);
    expect(findActiveNav(items, "/products/a")!.href).toBe("/products/a");
    expect(findActiveNav(items, "/products/x")!.href).toBe("/products");
    expect(findActiveNav(items, "/contact")).toBeUndefined();
    expect(hasActiveChild(items[1]!, "/products/a")).toBe(true);
    expect(hasActiveChild(items[1]!, "/about")).toBe(false);
  });
});

describe("filterNavByPermission", () => {
  const nav: NavItem[] = [
    { label: "ダッシュボード", href: "/" },
    { label: "予約", href: "/bookings", permission: "booking:read" },
    { label: "管理", href: "/admin", permission: "admin:access", children: [
      { label: "ユーザー", href: "/admin/users", permission: "user:manage" },
      { label: "設定", href: "/admin/settings", permission: "admin:settings" },
    ]},
  ];
  it("filters by permission predicate", () => {
    const viewer = new Set(["booking:read"]);
    const rv = filterNavByPermission(nav, (p) => viewer.has(p));
    expect(rv.map((i) => i.href)).toEqual(["/", "/bookings"]);
    const admin = new Set(["admin:access", "user:manage"]);
    const ra = filterNavByPermission(nav, (p) => admin.has(p));
    const node = ra.find((i) => i.href === "/admin")!;
    expect(node.children!.map((c) => c.href)).toEqual(["/admin/users"]);
    expect(filterNavByPermission(nav, () => true)).toHaveLength(3);
    expect(nav[2]!.children).toHaveLength(2); // 元配列不変
  });
});
