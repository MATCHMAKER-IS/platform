import { describe, it, expect } from "vitest";
import { isHidSupported, reportBytes } from "./index.js";

describe("hid", () => {
  it("navigator 無し環境では未対応", () => {
    expect(isHidSupported()).toBe(false);
  });
  it("reportBytes は DataView をバイト配列化", () => {
    const dv = new DataView(new Uint8Array([1, 2, 255]).buffer);
    expect(reportBytes(dv)).toEqual([1, 2, 255]);
  });
});
