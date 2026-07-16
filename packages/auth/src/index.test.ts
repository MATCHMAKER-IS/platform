import { describe, it, expect } from "vitest";
import { definePolicy, can, permissionsOf, assertCan, resolveIssuer } from "./index";
import { AppError } from "@platform/core";

const policy = definePolicy({
  admin: ["*"],
  sales: ["invoice:read", "invoice:create"],
  viewer: ["invoice:read"],
});

describe("RBAC", () => {
  it("完全一致・ワイルドカードを判定する", () => {
    expect(can(policy, ["sales"], "invoice:create")).toBe(true);
    expect(can(policy, ["viewer"], "invoice:create")).toBe(false);
    expect(can(policy, ["admin"], "anything:goes")).toBe(true);
  });

  it("リソースワイルドカードを判定する", () => {
    const p = definePolicy({ mgr: ["invoice:*"] });
    expect(can(p, ["mgr"], "invoice:approve")).toBe(true);
    expect(can(p, ["mgr"], "user:delete")).toBe(false);
  });

  it("permissionsOf は権限を集約する", () => {
    expect(permissionsOf(policy, ["sales", "viewer"]).sort()).toEqual(
      ["invoice:create", "invoice:read"].sort(),
    );
  });
});

describe("assertCan", () => {
  it("権限が無ければ FORBIDDEN を throw", () => {
    try {
      assertCan(policy, { id: "u1", roles: ["viewer"] }, "invoice:create");
      throw new Error("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe("FORBIDDEN");
    }
  });
});

describe("resolveIssuer", () => {
  it("Google/Entra の issuer を解決する", () => {
    expect(resolveIssuer({ kind: "google", clientId: "x", clientSecret: "y" })).toContain("google");
    expect(
      resolveIssuer({ kind: "entra", clientId: "x", clientSecret: "y", tenantId: "t1" }),
    ).toContain("t1");
  });
});
