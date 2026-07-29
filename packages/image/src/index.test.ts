import {
  describe, it, expect } from "vitest"; import { fitDimensions, clampRect, mimeForFormat, formatFromExtension, watermarkTextSvg,
} from "./index";

describe("fitDimensions", () => {
  it("contain: 4000x3000 → max2000 = 2000x1500", () => {
    expect(fitDimensions(4000, 3000, { maxWidth: 2000, maxHeight: 2000 })).toEqual({ width: 2000, height: 1500 });
  });
  it("cover: max2000 で覆う", () => {
    expect(fitDimensions(4000, 3000, { maxWidth: 2000, maxHeight: 2000, fit: "cover" })).toEqual({ width: 2667, height: 2000 });
  });
  it("withoutEnlargement: 小さい画像は拡大しない", () => {
    expect(fitDimensions(800, 600, { maxWidth: 2000, maxHeight: 2000 })).toEqual({ width: 800, height: 600 });
  });
});

describe("clampRect", () => {
  it("範囲外を丸める", () => {
    expect(clampRect({ left: -10, top: 5, width: 5000, height: 100 }, 1000, 800)).toEqual({ left: 0, top: 5, width: 1000, height: 100 });
  });
});

describe("format helpers", () => {
  it("mime / 拡張子", () => {
    expect(mimeForFormat("webp")).toBe("image/webp");
    expect(formatFromExtension("photo.JPG")).toBe("jpeg");
    expect(formatFromExtension("x.gif")).toBeNull();
  });
});

describe("watermarkTextSvg(属性のエスケープ)", () => {
  it("**属性に入る値をすべてエスケープする**", () => {
    // 以前は本文(text)だけで、fontFamily / color は素通しだった。
    // `" onload="…` の形で SVG に任意の属性を差し込める
    const svg = watermarkTextSvg("社外秘", { fontFamily: 'x" onload="alert(1)', color: 'red" onerror="x' });
    expect(svg).not.toContain('onload="alert(1)"');
    expect(svg).not.toContain('onerror="x"');
    expect(svg).toContain("&quot;");
  });

  it("本文もエスケープする", () => {
    expect(watermarkTextSvg("<script>")).toContain("&lt;script&gt;");
  });

  it("通常の指定は壊れない", () => {
    const svg = watermarkTextSvg("社外秘");
    expect(svg).toContain('font-family="sans-serif"');
    expect(svg).toContain('fill="#ffffff"');
    expect(svg.startsWith("<svg")).toBe(true);
  });
});
