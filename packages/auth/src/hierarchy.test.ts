import { describe, it, expect } from "vitest";
import { can } from "./rbac.js";
import { resolveHierarchy, canAny, canAll, canScoped, filterAuthorized, featureFlags } from "./hierarchy.js";

const policy = resolveHierarchy({
  employee: { permissions: ["expense:read:own", "expense:create"] },
  manager: { inherits: ["employee"], permissions: ["expense:approve:own"] },
  finance: { inherits: ["employee"], permissions: ["expense:approve:any", "expense:export"] },
  admin: { inherits: ["manager", "finance"], permissions: ["*"] },
});

describe("rbac hierarchy", () => {
  it("inheritance", () => { expect(can(policy, ["manager"], "expense:create")).toBe(true); expect(can(policy, ["employee"], "expense:approve:own")).toBe(false); expect(can(policy, ["admin"], "anything")).toBe(true); });
  it("canAny/canAll", () => { expect(canAny(policy, ["employee"], ["expense:export", "expense:create"])).toBe(true); expect(canAll(policy, ["employee"], ["expense:create", "expense:export"])).toBe(false); });
  it("canScoped own/any", () => { expect(canScoped(policy, ["manager"], "expense:approve", { isOwner: true })).toBe(true); expect(canScoped(policy, ["manager"], "expense:approve", { isOwner: false })).toBe(false); expect(canScoped(policy, ["finance"], "expense:approve", { isOwner: false })).toBe(true); });
  it("filterAuthorized + featureFlags", () => {
    const items = [{ p: "expense:create" }, { p: "expense:export" }];
    expect(filterAuthorized(policy, ["employee"], items, (i) => i.p)).toHaveLength(1);
    expect(featureFlags(policy, ["finance"], { exp: "expense:export", app: "expense:approve:any" })).toEqual({ exp: true, app: true });
  });
  it("cycle-safe", () => { const c = resolveHierarchy({ a: { inherits: ["b"], permissions: ["p:a"] }, b: { inherits: ["a"], permissions: ["p:b"] } }); expect(can(c, ["a"], "p:b")).toBe(true); });
});
