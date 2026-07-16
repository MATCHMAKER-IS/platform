import { describe, it, expect } from "vitest";
import { toggleExpanded, collectAllIds, findNode, pathToNode } from "./tree";
const nodes = [{ id: "a", children: [{ id: "a1" }, { id: "a2", children: [{ id: "a2x" }] }] }, { id: "b" }];
describe("tree logic", () => {
  it("toggles expansion immutably", () => {
    expect(toggleExpanded(new Set(), "a").has("a")).toBe(true);
    expect(toggleExpanded(new Set(["a"]), "a").has("a")).toBe(false);
  });
  it("collects, finds, paths", () => {
    expect(collectAllIds(nodes).sort()).toEqual(["a", "a1", "a2", "a2x", "b"]);
    expect(findNode(nodes, "a2x")?.id).toBe("a2x");
    expect(findNode(nodes, "zzz")).toBeUndefined();
    expect(pathToNode(nodes, "a2x")).toEqual(["a", "a2", "a2x"]);
  });
});
