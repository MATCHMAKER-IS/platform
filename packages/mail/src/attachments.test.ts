import { describe, it, expect } from "vitest";
import { attachmentFromBase64, attachmentSize, totalAttachmentSize, guessContentType, validateAttachments, inlineImage, transferSize } from "./attachments";
describe("mail attachments", () => {
  it("guesses type and computes base64 size", () => {
    expect(guessContentType("a.pdf")).toBe("application/pdf");
    expect(attachmentSize(attachmentFromBase64("x.txt", "SGVsbG8gV29ybGQ="))).toBe(11);
    expect(attachmentSize(attachmentFromBase64("x.txt", "YWJjZA=="))).toBe(4);
    expect(inlineImage("logo", "l.png", "AAAA").cid).toBe("logo");
  });
  it("validates limits", () => {
    const a = attachmentFromBase64("f.pdf", "SGVsbG8=");
    expect(validateAttachments([a], { maxTotalBytes: 1 }).ok).toBe(false);
    expect(validateAttachments([a, a, a], { maxCount: 2 }).ok).toBe(false);
    expect(validateAttachments([attachmentFromBase64("v.exe", "AA")], { blockedExtensions: ["exe"] }).ok).toBe(false);
    expect(validateAttachments([a], { maxCount: 5 }).ok).toBe(true);
    expect(totalAttachmentSize([a, a])).toBeGreaterThan(0);
  });
});

describe("transferSize: 送信時の転送量", () => {
  // **受信側の上限(Gmail 25MB / Outlook 20MB)は転送量に対する制限。**
  // 添付の元サイズで判断すると「送れるはずが弾かれる」
  it("base64 の膨張を織り込む(約 1.37 倍)", () => {
    const raw = new Uint8Array(3 * 1024 * 1024);
    const size = transferSize([{ filename: "a.pdf", content: raw }]);
    expect(size).toBeGreaterThan(raw.byteLength * 1.33);
    expect(size).toBeLessThan(raw.byteLength * 1.4);
  });
  // **既定の 25MB は転送量 34MB。** Gmail でも Outlook でも通らない
  it("既定の上限いっぱいでも受信側では超える", () => {
    const raw = new Uint8Array(25 * 1024 * 1024);
    expect(transferSize([{ filename: "a.pdf", content: raw }])).toBeGreaterThan(25 * 1024 * 1024);
  });
  // **18MB なら Gmail に収まる**(境界の目安)
  it("18MB なら 25MB に収まる", () => {
    const raw = new Uint8Array(18 * 1024 * 1024);
    expect(transferSize([{ filename: "a.pdf", content: raw }])).toBeLessThan(25 * 1024 * 1024);
  });
  it("添付が無ければ 0", () => {
    expect(transferSize([])).toBe(0);
  });
});
