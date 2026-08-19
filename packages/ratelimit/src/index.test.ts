import { describe, it, expect } from "vitest";
import { createRateLimiter, createMemoryStore } from "./index";

describe("ratelimit (memory)", () => {
  it("上限まで許可し、超過で拒否する", async () => {
    const limiter = createRateLimiter({ store: createMemoryStore(), limit: 3, windowSeconds: 60 });
    const key = "user:1";
    for (let i = 0; i < 3; i++) {
      const r = await limiter.check(key);
      expect(r.ok && r.value.allowed).toBe(true);
    }
    const over = await limiter.check(key);
    expect(over.ok && over.value.allowed).toBe(false);
    if (over.ok) expect(over.value.remaining).toBe(0);
  });

  it("キーが違えば独立してカウントする", async () => {
    const limiter = createRateLimiter({ store: createMemoryStore(), limit: 1, windowSeconds: 60 });
    expect((await limiter.check("a")).ok).toBe(true);
    const b = await limiter.check("b");
    expect(b.ok && b.value.allowed).toBe(true);
  });
});

describe("キーの長さを制限する", () => {
  // **キーは外部入力から組み立てられることが多い**(`login:${email}` など)。
  // 任意長を通すと、毎回違う巨大な文字列を送るだけでストアにキーが溜まり続け、
  // **レート制限そのものが攻撃の的になる**(2026-08 に対処)
  it("長すぎるキーは切り詰めてストアに渡す", async () => {
    const seen: string[] = [];
    const limiter = createRateLimiter({
      store: { increment: async (k: string) => { seen.push(k); return 1; } },
      limit: 5,
      windowSeconds: 60,
    });
    await limiter.check("x".repeat(1000));
    expect(seen[0]?.length).toBeLessThanOrEqual(256);
  });
  // **短いキーはそのまま**(境界)
  it("短いキーは変えない", async () => {
    const seen: string[] = [];
    const limiter = createRateLimiter({
      store: { increment: async (k: string) => { seen.push(k); return 1; } },
      limit: 5,
      windowSeconds: 60,
    });
    await limiter.check("login:a@b.jp");
    expect(seen[0]).toBe("login:a@b.jp");
  });
});
