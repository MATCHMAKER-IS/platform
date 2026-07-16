import { describe, it, expect } from "vitest";
import { resolveRoles } from "./roles";

describe("roles directory", () => {
  it("maps email to roles", () => {
    const env = { ROLE_MAP: "a@x.jp=admin;b@x.jp=finance,manager", DEFAULT_ROLES: "employee" };
    expect(resolveRoles("a@x.jp", env)).toEqual(["admin"]);
    expect(resolveRoles("b@x.jp", env)).toEqual(["finance", "manager"]);
    expect(resolveRoles("unknown@x.jp", env)).toEqual(["employee"]);
  });
});
