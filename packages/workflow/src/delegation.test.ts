import { describe, it, expect } from "vitest";
import { activeDelegations, effectiveRoles, resolveApprovalAuthority } from "./delegation";
const now = new Date("2025-07-25T12:00:00Z");
const dels = [{ from: "bucho", to: "kacho", roles: ["director"], since: new Date("2025-07-20"), until: new Date("2025-07-30") }];
describe("delegation", () => {
  it("filters by active period", () => {
    expect(activeDelegations(dels, now)).toHaveLength(1);
    expect(activeDelegations(dels, new Date("2025-08-01"))).toHaveLength(0);
  });
  it("computes effective roles and approval authority", () => {
    expect(effectiveRoles({ id: "kacho", roles: ["manager"] }, dels, { now }).sort()).toEqual(["director", "manager"]);
    const auth = resolveApprovalAuthority({ name: "部長", approverRole: "director" }, { id: "kacho", roles: ["manager"] }, dels, { now });
    expect(auth.canApprove).toBe(true);
    expect(auth.onBehalfOf).toBe("bucho");
  });
});
