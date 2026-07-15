import { describe, it, expect, vi, afterEach } from "vitest";
import { createAddressLookup, createZipcloudAdapter, normalizeZipcode } from "./index.js";

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
