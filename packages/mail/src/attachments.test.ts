import { describe, it, expect } from "vitest";
import { attachmentFromBase64, attachmentSize, totalAttachmentSize, guessContentType, validateAttachments, inlineImage } from "./attachments";
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
