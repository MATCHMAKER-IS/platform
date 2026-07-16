import { describe, it, expect } from "vitest";
import { isBlockVisible, visibleBlocks, blocksByType, findBlock, reorderBlocks, moveBlockUp, moveBlockDown } from "./blocks";
const now = new Date("2025-07-25T12:00:00Z");
const page = { slug: "home", title: "T", blocks: [
  { id: "h", type: "hero" as const, data: {} },
  { id: "f", type: "features" as const, data: {}, visible: false },
  { id: "c", type: "cta" as const, data: {}, visibleFrom: "2025-08-01T00:00:00Z" },
  { id: "faq", type: "faq" as const, data: {} },
  { id: "s", type: "stats" as const, data: {} },
] };
describe("page blocks", () => {
  it("filters visible and by type", () => {
    expect(visibleBlocks(page, now).map((b) => b.id)).toEqual(["h", "faq", "s"]);
    expect(isBlockVisible(page.blocks[2]!, now)).toBe(false);
    expect(blocksByType(page, "hero")).toHaveLength(1);
    expect(findBlock(page, "s")!.type).toBe("stats");
  });
  it("reorders", () => {
    expect(reorderBlocks(page.blocks, 0, 2).map((b) => b.id)).toEqual(["f", "c", "h", "faq", "s"]);
    expect(moveBlockUp(page.blocks, "f").map((b) => b.id)).toEqual(["f", "h", "c", "faq", "s"]);
    expect(moveBlockDown(page.blocks, "h").map((b) => b.id)).toEqual(["f", "h", "c", "faq", "s"]);
  });
});
