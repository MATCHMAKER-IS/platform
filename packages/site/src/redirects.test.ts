import { describe, it, expect } from "vitest";
import { resolveRedirect, resolveRedirectChain } from "./redirects.js";
const rules = [
  { from: "/old-page", to: "/new-page" },
  { from: "/blog/*", to: "/articles/:splat", status: 301 as const },
  { from: "/campaign", to: "/sale", status: 302 as const },
];
describe("redirects", () => {
  it("resolves exact and wildcard", () => {
    expect(resolveRedirect(rules, "/old-page")).toEqual({ to: "/new-page", status: 301 });
    expect(resolveRedirect(rules, "/old-page/?utm=x")!.to).toBe("/new-page");
    expect(resolveRedirect(rules, "/blog/2025/hello")!.to).toBe("/articles/2025/hello");
    expect(resolveRedirect(rules, "/blog")!.to).toBe("/articles");
    expect(resolveRedirect(rules, "/campaign")!.status).toBe(302);
    expect(resolveRedirect(rules, "/other")).toBeNull();
  });
  it("follows chains and breaks cycles", () => {
    expect(resolveRedirectChain([{ from: "/a", to: "/b" }, { from: "/b", to: "/c" }], "/a")!.to).toBe("/c");
    expect(resolveRedirectChain([{ from: "/x", to: "/y" }, { from: "/y", to: "/x" }], "/x")).not.toBeNull();
  });
});
