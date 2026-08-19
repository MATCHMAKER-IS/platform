import { describe, it, expect } from "vitest";
import { pageCss, createReceipt } from "./index";

describe("pageCss", () => {
  it("size/margin を反映", () => {
    // **完全一致では固定しない。** 2026-08 に印刷でしか起きない問題への
    // 手当て(背景色・改ページ・見出しの繰り返し)を足したところ、
    // **中身は正しいのにここだけ落ちた**。見たいのは「size/margin が反映されるか」
    // なので、その行だけを確かめる。
    expect(pageCss({ size: "A4", margin: "10mm" })).toContain("@page { size: A4; margin: 10mm; }");
  });
  it("印刷でしか起きない問題への手当てが入る", () => {
    const css = pageCss();
    // 背景色を出す(表の見出し行が白くならない)
    expect(css).toContain("print-color-adjust: exact");
    // 行が上下のページに割れない
    expect(css).toContain("break-inside: avoid");
    // 見出し行を各ページに繰り返す
    expect(css).toContain("table-header-group");
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
