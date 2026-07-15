import { describe, it, expect } from "vitest";
import { parseUserAgent } from "./index.js";

describe("parseUserAgent", () => {
  it("iPhone Safari を判定", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    const r = parseUserAgent(ua);
    expect(r.os.name).toBe("iOS");
    expect(r.device.type).toBe("mobile");
    expect(r.browser.name).toMatch(/Safari/);
  });
  it("Windows Chrome デスクトップを判定(type は desktop)", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
    const r = parseUserAgent(ua);
    expect(r.os.name).toMatch(/Windows/);
    expect(r.browser.name).toBe("Chrome");
    expect(r.device.type).toBe("desktop");
  });
  it("Android タブレットを判定", () => {
    const ua = "Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
    const r = parseUserAgent(ua);
    expect(r.os.name).toBe("Android");
  });
});
