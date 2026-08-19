import { describe, it, expect } from "vitest";
import { createImageProcessor, type SharpFactory } from "./index";

/**
 * sharp の呼び出しを記録するだけのスタブ。
 *
 * **`rotate` に何が渡されたか**を見たい。EXIF 補正は
 * 「引数を渡さないこと」でしか働かないので、そこを固定する。
 */
function makeSpy(): { calls: string[]; factory: SharpFactory } {
  const calls: string[] = [];
  const instance = {
    resize: () => instance,
    extract: () => instance,
    rotate: (angle?: number) => { calls.push(`rotate(${angle === undefined ? "" : angle})`); return instance; },
    flip: () => instance,
    flop: () => instance,
    grayscale: () => instance,
    negate: () => instance,
    tint: () => instance,
    modulate: () => instance,
    blur: () => instance,
    sharpen: () => instance,
    composite: () => instance,
    toFormat: () => instance,
    withMetadata: () => instance,
    metadata: async () => ({}),
    toBuffer: async () => Buffer.from([]),
  };
  return { calls, factory: (() => instance) as unknown as SharpFactory };
}

describe("EXIF の向き補正", () => {
  // **これが本題。** `rotate(0)` だと EXIF を見ずに 0 度回すだけになり、
  // スマホで撮った写真が横倒しのまま表示される
  it("normalizeUpload は rotate を引数なしで呼ぶ", async () => {
    const spy = makeSpy();
    await createImageProcessor(spy.factory).normalizeUpload(Buffer.from([]));
    expect(spy.calls).toContain("rotate()");
    expect(spy.calls).not.toContain("rotate(0)");
  });

  // **順番が重要。** EXIF を捨ててから回しても、向き情報はもう無い
  it("stripMetadata は EXIF を捨てる前に向きを反映する", async () => {
    const spy = makeSpy();
    await createImageProcessor(spy.factory).stripMetadata(Buffer.from([]));
    expect(spy.calls[0]).toBe("rotate()");
  });

  // **明示的な回転は従来どおり角度を渡す**(利用者が「右に90度」を選んだ場合)
  it("rotate 操作は角度を渡す", async () => {
    const spy = makeSpy();
    await createImageProcessor(spy.factory).process(Buffer.from([]), [{ op: "rotate", angle: 90 }]);
    expect(spy.calls).toContain("rotate(90)");
  });
});
