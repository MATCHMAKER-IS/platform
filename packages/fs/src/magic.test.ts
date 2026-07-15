import { describe, it, expect } from "vitest";
import { detectFileType, isAllowedFileType, extensionMatchesContent } from "./magic.js";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

describe("magic bytes", () => {
  it("detect", () => { expect(detectFileType(PNG)!.ext).toBe("png"); expect(detectFileType(new Uint8Array([0xff, 0xd8, 0xff]))!.mime).toBe("image/jpeg"); expect(detectFileType(new Uint8Array([0, 1, 2]))).toBeNull(); });
  it("allowed", () => { expect(isAllowedFileType(PNG, ["png", "jpg"])).toBe(true); expect(isAllowedFileType(ZIP, [".pdf"])).toBe(false); });
  it("extension spoof detection", () => { expect(extensionMatchesContent("a.png", PNG)).toBe(true); expect(extensionMatchesContent("a.jpeg", new Uint8Array([0xff, 0xd8, 0xff]))).toBe(true); expect(extensionMatchesContent("evil.png", ZIP)).toBe(false); });
});
