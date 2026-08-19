import { describe, it, expect, vi, afterEach } from "vitest";
import { createAddressLookup, createZipcloudAdapter, normalizeZipcode, isValidZipcode } from "./index";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; vi.restoreAllMocks(); });

function zipRes(body: unknown) {
  return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => body };
}

describe("address", () => {
  it("normalizeZipcode は全角・ハイフンを正規化", () => {
    expect(normalizeZipcode("１００-０００１")).toBe("1000001");
    expect(normalizeZipcode("100-0001")).toBe("1000001");
  });

  it("郵便番号から住所を返す", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(zipRes({
      status: 200, message: null,
      results: [{ zipcode: "1000001", address1: "東京都", address2: "千代田区", address3: "千代田", kana1: "ﾄｳｷｮｳﾄ" }],
    })) as unknown as typeof fetch;
    const address = createAddressLookup(createZipcloudAdapter());
    const res = await address.lookup("100-0001");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value[0]?.prefecture).toBe("東京都");
      expect(res.value[0]?.city).toBe("千代田区");
    }
  });

  it("該当なしは空配列", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(zipRes({ status: 200, message: null, results: null })) as unknown as typeof fetch;
    const address = createAddressLookup(createZipcloudAdapter());
    const res = await address.lookup("0000000");
    expect(res.ok && res.value).toEqual([]);
  });
});

describe("isValidZipcode: 桁数の検証", () => {
  // **`normalizeZipcode` は桁を見ない。** 判定はこちらの仕事
  it("7 桁なら true(全角・ハイフンも可)", () => {
    expect(isValidZipcode("100-0001")).toBe(true);
    expect(isValidZipcode("１００−０００１")).toBe(true);
    expect(isValidZipcode("1000001")).toBe(true);
  });
  // **誤入力を外部 API へ送らない。** 返る「該当なし」が
  // 入力の誤りか実在しない番号か区別できなくなる
  it("桁が違えば false", () => {
    expect(isValidZipcode("100-00011")).toBe(false);  // 8 桁
    expect(isValidZipcode("100-000")).toBe(false);    // 6 桁
  });
  it("数字が無ければ false", () => {
    expect(isValidZipcode("東京都")).toBe(false);
    expect(isValidZipcode("")).toBe(false);
  });
});

describe("createAddressLookup: 不正な入力は外部へ送らない", () => {
  it("桁違いは VALIDATION で弾く(adapter を呼ばない)", async () => {
    let called = 0;
    const lookup = createAddressLookup({
      lookup: async () => { called += 1; return { ok: true, value: [] }; },
    });
    const res = await lookup.lookup("東京都千代田区");
    expect(res.ok).toBe(false);
    expect(called).toBe(0);
  });
});
