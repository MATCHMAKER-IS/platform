import { describe, it, expect } from "vitest";
import { profileItems, profileCompleteness, hasRequiredProfile } from "./profile";
const fields = [{ key: "name", label: "名前" }, { key: "tags", label: "得意" }, { key: "height", label: "身長" }, { key: "message", label: "ひとこと" }];
const cast = { id: "x", name: "あおい", status: "active" as const, tags: ["ダンス"], height: "160cm" };
describe("cast profile", () => {
  it("builds items and completeness", () => {
    const items = profileItems(cast, fields);
    expect(items).toHaveLength(3);
    expect(items.find((i) => i.label === "得意")!.value).toBe("ダンス");
    expect(profileCompleteness(cast, fields)).toBe(0.75);
    expect(hasRequiredProfile(cast, ["name", "tags"])).toBe(true);
    expect(hasRequiredProfile(cast, ["name", "message"])).toBe(false);
  });
});
