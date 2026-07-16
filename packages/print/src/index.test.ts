import { describe, it, expect } from "vitest";
import { pageCss, createReceipt } from "./index";

describe("pageCss", () => {
  it("size/margin を反映", () => {
    expect(pageCss({ size: "A4", margin: "10mm" })).toBe("@page { size: A4; margin: 10mm; }");
  });
});

describe("createReceipt", () => {
  it("init は ESC @", () => {
    expect(Array.from(createReceipt().init().build())).toEqual([0x1b, 0x40]);
  });
  it("align center / bold / cut のコマンド列", () => {
    const bytes = Array.from(createReceipt().align("center").bold(true).line("A").cut().build());
    expect(bytes).toEqual([0x1b, 0x61, 1, 0x1b, 0x45, 1, 0x41, 0x0a, 0x1d, 0x56, 0x00]);
  });
  it("size 倍率(2,2)", () => {
    expect(Array.from(createReceipt().size(2, 2).build())).toEqual([0x1d, 0x21, (1 << 4) | 1]);
  });
});
