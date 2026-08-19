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

describe("自分自身への委任は無効", () => {
  const now = new Date("2026-08-10");
  // **持っていないロールを自分で獲得できてしまう。**
  // 委任の登録画面に「委任元」の入力があれば、自分の名前を入れるだけで昇格できる。
  // 設定ミス(コピペで from と to が同じ)でも起きる(2026-08 に対処)
  it("from と to が同じなら有効にしない", () => {
    const self = [{ from: "u1", to: "u1", roles: ["director"], since: new Date("2026-08-01") }];
    expect(activeDelegations(self, now)).toHaveLength(0);
    expect(effectiveRoles({ id: "u1", roles: [] }, self, { now })).toHaveLength(0);
  });
  // **他人への委任は従来どおり**
  it("別人への委任は有効", () => {
    const other = [{ from: "u1", to: "u2", roles: ["director"], since: new Date("2026-08-01") }];
    expect(effectiveRoles({ id: "u2", roles: [] }, other, { now })).toEqual(["director"]);
  });
});
