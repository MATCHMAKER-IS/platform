import { describe, it, expect } from "vitest";
import { emptySelection, toggleRow, isAllSelected, isIndeterminate, toggleAll, selectionCount, selectedKeys } from "./table";
describe("list selection", () => {
  it("toggles rows and all", () => {
    let sel = toggleRow(toggleRow(emptySelection(), "a"), "b");
    const keys = ["a", "b", "c"];
    expect(selectionCount(sel)).toBe(2);
    expect(isIndeterminate(sel, keys)).toBe(true);
    expect(isAllSelected(sel, keys)).toBe(false);
    sel = toggleAll(sel, keys);
    expect(isAllSelected(sel, keys)).toBe(true);
    expect(selectionCount(toggleAll(sel, keys))).toBe(0);
    expect(selectedKeys(toggleRow(emptySelection(), "x"))).toEqual(["x"]);
  });
});
