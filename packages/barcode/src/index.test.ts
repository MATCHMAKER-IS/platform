import { describe, it, expect } from "vitest";
import { buildAssetUrl } from "./index";

// qrcode / bwip-js を呼ぶ関数は、ライブラリの実体が要るのでここでは検査しない。
// (ライブラリの動作は各ライブラリのテストが担保する。ここは基盤側のロジックを見る)
describe("buildAssetUrl", () => {
  it("ベース URL の末尾スラッシュを吸収する", () => {
    expect(buildAssetUrl({ baseUrl: "https://a.jp/", kind: "asset", id: "A-1" })).toBe("https://a.jp/asset/A-1");
    expect(buildAssetUrl({ baseUrl: "https://a.jp///", kind: "asset", id: "A-1" })).toBe("https://a.jp/asset/A-1");
    expect(buildAssetUrl({ baseUrl: "https://a.jp", kind: "asset", id: "A-1" })).toBe("https://a.jp/asset/A-1");
  });

  it("ID をエスケープする(QR に入る URL が壊れないため)", () => {
    expect(buildAssetUrl({ baseUrl: "https://a.jp", kind: "asset", id: "A/42" })).toBe("https://a.jp/asset/A%2F42");
    expect(buildAssetUrl({ baseUrl: "https://a.jp", kind: "asset", id: "備品 1" })).toBe("https://a.jp/asset/%E5%82%99%E5%93%81%201");
  });

  it("kind もエスケープする", () => {
    expect(buildAssetUrl({ baseUrl: "https://a.jp", kind: "a b", id: "1" })).toBe("https://a.jp/a%20b/1");
  });
});
