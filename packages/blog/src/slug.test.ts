import { describe, it, expect } from "vitest";
import { slugify, ensureSlug, uniqueSlug } from "./slug.js";
describe("slug", () => {
  it("slugifies ascii and unicode", () => {
    expect(slugify("Hello World! My First Post")).toBe("hello-world-my-first-post");
    expect(slugify("  Foo -- Bar  ")).toBe("foo-bar");
    expect(slugify("こんにちは世界")).toBe("");
    expect(slugify("こんにちは 世界", { allowUnicode: true })).toBe("こんにちは-世界");
    expect(slugify("aaaa bbbb cccc", { maxLength: 9 })).toBe("aaaa-bbbb");
  });
  it("ensures and de-duplicates", () => {
    expect(ensureSlug("こんにちは", "post-123")).toBe("post-123");
    expect(uniqueSlug("hello", ["hello", "hello-2"])).toBe("hello-3");
    expect(uniqueSlug("new", ["hello"])).toBe("new");
  });
});
