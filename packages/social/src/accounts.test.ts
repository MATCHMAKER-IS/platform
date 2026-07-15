import { describe, it, expect } from "vitest";
import { makeAccount, accountFromUrl, accountsFromUrls, accountLinks, accountsByPlatform, dedupeAccounts } from "./accounts.js";
describe("social accounts", () => {
  it("makes accounts from handles and urls", () => {
    expect(makeAccount("x", "@yamada")).toMatchObject({ handle: "yamada", url: "https://x.com/yamada" });
    expect(makeAccount("x", "bad handle")).toBeNull();
    expect(accountFromUrl("https://www.tiktok.com/@cast01/video/71")).toMatchObject({ platform: "tiktok", handle: "cast01" });
  });
  it("collects, dedupes, and links from pasted urls", () => {
    const urls = ["https://x.com/yamada_taro", "https://twitter.com/yamada_taro", "https://www.tiktok.com/@yamada.dance", "https://www.instagram.com/yamada_ig/", "https://example.com/x", "@bad handle"];
    const accounts = accountsFromUrls(urls);
    expect(accounts).toHaveLength(3);
    expect(accounts.filter((a) => a.platform === "x")).toHaveLength(1);
    const links = accountLinks(accounts);
    expect(links.map((l) => l.platform)).toEqual(["x", "tiktok", "instagram"]);
    expect(links[1]!.label).toBe("@yamada.dance");
    expect(accountsByPlatform(accounts).instagram!.handle).toBe("yamada_ig");
    expect(dedupeAccounts([{ platform: "x", handle: "a", url: "u" }, { platform: "x", handle: "A", url: "u" }])).toHaveLength(1);
  });
});
