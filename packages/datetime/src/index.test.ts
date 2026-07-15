import { describe, it, expect } from "vitest";
import { formatJst, startOfDayJst, endOfDayJst, JST } from "./index.js";

describe("datetime (JST)", () => {
  it("UTC を JST(+9)で整形する", () => {
    expect(formatJst(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01-01 09:00");
  });

  it("JST の日の始まりは UTC 前日 15:00", () => {
    const s = startOfDayJst(new Date("2026-01-01T12:00:00Z"));
    expect(s.toISOString()).toBe("2025-12-31T15:00:00.000Z");
  });

  it("JST の日の終わりは UTC 当日 14:59:59.999", () => {
    const e = endOfDayJst(new Date("2026-01-01T12:00:00Z"));
    expect(e.toISOString()).toBe("2026-01-01T14:59:59.999Z");
  });

  it("JST 定数", () => {
    expect(JST).toBe("Asia/Tokyo");
  });
});
