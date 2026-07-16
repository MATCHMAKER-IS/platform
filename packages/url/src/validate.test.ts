import { describe, it, expect } from "vitest";
import { isValidUrl, isHttpUrl, isSafeUrl, isSameOrigin, isExternalUrl } from "./validate";
describe("url validate", () => {
  it("validates and checks safety", () => {
    expect(isValidUrl("https://ex.com")).toBe(true);
    expect(isValidUrl("not url")).toBe(false);
    expect(isHttpUrl("ftp://ex.com")).toBe(false);
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("data:text/html,x")).toBe(false);
    expect(isSafeUrl("https://ex.com")).toBe(true);
    expect(isSafeUrl("/relative")).toBe(true);
    expect(isSameOrigin("https://ex.com/a", "https://ex.com/b")).toBe(true);
    expect(isExternalUrl("https://other.com/x", "example.com")).toBe(true);
    expect(isExternalUrl("/internal", "example.com")).toBe(false);
  });
});
