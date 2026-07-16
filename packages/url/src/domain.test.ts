import { describe, it, expect } from "vitest";
import { getRegistrableDomain, getSubdomain, getTld, stripWww, isSameDomain, isSameHost, getHostname } from "./domain";
describe("url domain", () => {
  it("extracts registrable domain (eTLD+1)", () => {
    expect(getRegistrableDomain("www.example.com")).toBe("example.com");
    expect(getRegistrableDomain("www.example.co.jp")).toBe("example.co.jp");
    expect(getRegistrableDomain("blog.mysite.ne.jp")).toBe("mysite.ne.jp");
    expect(getRegistrableDomain("shop.example.co.uk")).toBe("example.co.uk");
    expect(getRegistrableDomain("https://a.b.example.com/path")).toBe("example.com");
    expect(getRegistrableDomain("192.168.1.1")).toBe("192.168.1.1");
  });
  it("extracts subdomain, tld, and compares", () => {
    expect(getSubdomain("a.b.example.co.jp")).toBe("a.b");
    expect(getSubdomain("example.com")).toBe("");
    expect(getTld("example.co.jp")).toBe("co.jp");
    expect(stripWww("www.example.com")).toBe("example.com");
    expect(isSameDomain("www.example.com", "api.example.com")).toBe(true);
    expect(isSameDomain("example.com", "other.com")).toBe(false);
    expect(isSameHost("www.example.com", "api.example.com")).toBe(false);
    expect(getHostname("https://EX.com/a")).toBe("ex.com");
  });
});
