import { describe, it, expect } from "vitest";
import { Overlay, BusyOverlay } from "./overlay";

// **膜は「操作できない」ことを見せるもの。**
// 出しっぱなし・濃すぎ・押せてしまう、のどれも実害になる
describe("Overlay", () => {
  it("open が false なら何も描かない", () => {
    // **`hidden` で隠すだけにしない。** 中の画像や重い表が
    // 読み込まれ続けてしまう
    expect(Overlay({ open: false })).toBeNull();
  });

  it("open が true なら描く", () => {
    expect(Overlay({ open: true })).not.toBeNull();
  });

  // **濃すぎると、何の上に出ているか分からなくなる**
  it("濃さは 0.6 までに収める", () => {
    const el = Overlay({ open: true, opacity: 0.95 }) as { props: { style: { backgroundColor: string } } };
    expect(el.props.style.backgroundColor).toBe("rgb(0 0 0 / 0.6)");
  });

  it("負の濃さは 0 にする", () => {
    const el = Overlay({ open: true, opacity: -1 }) as { props: { style: { backgroundColor: string } } };
    expect(el.props.style.backgroundColor).toBe("rgb(0 0 0 / 0)");
  });

  it("既定の濃さは 0.4(Dialog と揃える)", () => {
    const el = Overlay({ open: true }) as { props: { style: { backgroundColor: string } } };
    expect(el.props.style.backgroundColor).toBe("rgb(0 0 0 / 0.4)");
  });

  // **押せないのに指の形が出ると、「押しても閉じない」と思われる**
  it("onClick が無ければ指の形にしない", () => {
    const el = Overlay({ open: true }) as { props: { className: string } };
    expect(el.props.className).not.toContain("cursor-pointer");
  });

  it("onClick があれば指の形にする", () => {
    const el = Overlay({ open: true, onClick: () => {} }) as { props: { className: string } };
    expect(el.props.className).toContain("cursor-pointer");
  });

  // **中身が無ければ読み上げない**(膜そのものは情報ではない)
  it("中身が無ければ aria-hidden", () => {
    const el = Overlay({ open: true }) as { props: { "aria-hidden": boolean } };
    expect(el.props["aria-hidden"]).toBe(true);
  });

  it("Dialog(z-50)より下に置く", () => {
    const el = Overlay({ open: true }) as { props: { style: { zIndex: number } } };
    expect(el.props.style.zIndex).toBeLessThan(50);
  });
});

/**
 * 要素の中の**文字だけ**を集める。
 *
 * **`JSON.stringify` は使いません。** React 要素は内部の持ち物が版で変わるので、
 * **形に依存した試験は、React を上げた日に理由も分からず落ちます**。
 * children を辿るだけなら、その心配がありません。
 *
 * @param node 調べる要素
 * @returns 見つかった文字をつないだもの
 */
function textOf(node: unknown): string {
  if (node === null || node === undefined || node === false || node === true) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  const children = (node as { props?: { children?: unknown } }).props?.children;
  return children === undefined ? "" : textOf(children);
}

describe("BusyOverlay", () => {
  it("busy が false なら何も描かない", () => {
    expect(BusyOverlay({ busy: false })).toBeNull();
  });

  // **膜だけだと「固まった」と思われる。** 文言を必ず出す
  it("既定の文言がある", () => {
    // **`not.toBeNull()` だけでは足りません。**
    // busy が false のときも要素は返っていたので、
    // **この試験は何も確かめずに通っていました**(2026-08)。
    // 文言そのものを見ます
    expect(textOf(BusyOverlay({ busy: true }))).toContain("処理しています…");
  });

  it("文言を差し替えられる", () => {
    expect(textOf(BusyOverlay({ busy: true, label: "保存しています…" })))
      .toContain("保存しています…");
  });
});
