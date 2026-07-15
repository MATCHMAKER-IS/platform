import { describe, it, expect, vi } from "vitest";
import { chunk, groupBy, uniqueBy, safeJsonParse, retry, sleep } from "./index.js";

describe("utils", () => {
  it("chunk は分割する", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it("groupBy はキーでまとめる", () => {
    expect(groupBy([1, 2, 3, 4], (n) => (n % 2 === 0 ? "even" : "odd"))).toEqual({
      odd: [1, 3], even: [2, 4],
    });
  });
  it("uniqueBy は先勝ちで重複除去", () => {
    expect(uniqueBy([{ id: 1 }, { id: 1 }, { id: 2 }], (x) => x.id)).toEqual([{ id: 1 }, { id: 2 }]);
  });
  it("safeJsonParse は失敗を Result で返す", () => {
    expect(safeJsonParse("{bad").ok).toBe(false);
    const good = safeJsonParse<{ a: number }>('{"a":1}');
    expect(good.ok && good.value).toEqual({ a: 1 });
  });
  it("retry は失敗後に成功すれば値を返す", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("x")).mockResolvedValueOnce("ok");
    expect(await retry(fn, { attempts: 3, baseDelayMs: 1 })).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it("sleep は待つ", async () => {
    const t = Date.now();
    await sleep(5);
    expect(Date.now() - t).toBeGreaterThanOrEqual(4);
  });
});
