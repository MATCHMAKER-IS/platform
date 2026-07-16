import { describe, it, expect } from "vitest";
import { copyToClipboard, readClipboard } from "./clipboard";
describe("ui clipboard", () => {
  it("copies via injected writer", async () => {
    let wrote: string | null = null;
    expect(await copyToClipboard("hi", async (t) => { wrote = t; })).toBe(true);
    expect(wrote).toBe("hi");
    expect(await copyToClipboard("x", async () => { throw new Error("no"); })).toBe(false);
    expect(await copyToClipboard("x")).toBe(false);
  });
  it("pastes via injected reader", async () => {
    expect(await readClipboard(async () => "pasted")).toBe("pasted");
    expect(await readClipboard(async () => { throw new Error("no"); })).toBeNull();
    expect(await readClipboard()).toBeNull();
  });
});
