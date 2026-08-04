import { describe, it, expect } from "vitest";
import { createRevocationGate, createMemoryRevocationStore } from "./revocation";

/** 時刻を手で進められるゲートを作る。 */
function setup() {
  const clock = { t: 1_000 };
  const now = () => clock.t;
  const gate = createRevocationGate({ store: createMemoryRevocationStore(now), now });
  return { gate, clock };
}

describe("revokeUser(利用者の強制ログアウト)", () => {
  it("何もしていなければ通る", async () => {
    const { gate } = setup();
    expect((await gate.check("u42", 900)).allowed).toBe(true);
  });

  it("**失効より前に発行されたセッションは通らない**", async () => {
    const { gate, clock } = setup();
    clock.t = 2_000;
    await gate.revokeUser("u42");
    const d = await gate.check("u42", 900);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.kind).toBe("revoked");
  });

  it("失効より後に発行されたセッションは通る(再ログインできる)", async () => {
    const { gate, clock } = setup();
    clock.t = 2_000;
    await gate.revokeUser("u42");
    expect((await gate.check("u42", 2_500)).allowed).toBe(true);
  });

  it("**他の利用者は巻き込まない**", async () => {
    const { gate, clock } = setup();
    clock.t = 2_000;
    await gate.revokeUser("u42");
    expect((await gate.check("u99", 900)).allowed).toBe(true);
  });
});

describe("revokeAll(全員の緊急停止)", () => {
  it("全員が通らなくなる", async () => {
    const { gate, clock } = setup();
    clock.t = 3_000;
    await gate.revokeAll();
    expect((await gate.check("u1", 900)).allowed).toBe(false);
    expect((await gate.check("u2", 900)).allowed).toBe(false);
  });

  it("停止後に発行されたセッションは通る", async () => {
    const { gate, clock } = setup();
    clock.t = 3_000;
    await gate.revokeAll();
    expect((await gate.check("u1", 3_500)).allowed).toBe(true);
  });
});

describe("block(締め出し)", () => {
  it("**セッションもログインも止まる**(追い出すだけでは戻ってこられる)", async () => {
    const { gate } = setup();
    await gate.block("u7", { reason: "退職(2026-08-31)", by: "admin" });
    const s = await gate.check("u7", Number.MAX_SAFE_INTEGER);
    expect(s.allowed).toBe(false);
    if (!s.allowed) expect(s.kind).toBe("blocked");
    expect((await gate.checkLogin("u7")).allowed).toBe(false);
  });

  it("解除するとログインできる", async () => {
    const { gate } = setup();
    await gate.block("u7", { reason: "調査" });
    await gate.unblock("u7");
    expect((await gate.checkLogin("u7")).allowed).toBe(true);
  });

  it("**期限つきの締め出しは自動で解ける**", async () => {
    const { gate, clock } = setup();
    await gate.block("u8", { reason: "調査中", until: 5_000 });
    expect((await gate.checkLogin("u8")).allowed).toBe(false);
    clock.t = 6_000;
    expect((await gate.checkLogin("u8")).allowed).toBe(true);
  });

  it("**理由が無ければ拒否**(後から解除の可否を判断できない)", async () => {
    const { gate } = setup();
    await expect(gate.block("u9", { reason: "   " })).rejects.toThrow();
  });

  it("一覧に理由と操作者が残る", async () => {
    const { gate } = setup();
    await gate.block("u7", { reason: "退職", by: "admin" });
    const list = await gate.listBlocked();
    expect(list).toHaveLength(1);
    expect(list[0]?.userId).toBe("u7");
    expect(list[0]?.block.by).toBe("admin");
  });

  it("keys を持たないストアでは一覧は空(判定は効く)", async () => {
    const mem = createMemoryRevocationStore();
    const gate = createRevocationGate({ store: { get: mem.get, set: mem.set, delete: mem.delete } });
    await gate.block("u7", { reason: "退職" });
    expect(await gate.listBlocked()).toEqual([]);
    expect((await gate.checkLogin("u7")).allowed).toBe(false);
  });
});
