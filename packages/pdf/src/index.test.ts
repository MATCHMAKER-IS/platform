import { describe, it, expect, vi } from "vitest";
import { createPdf, type PdfRenderer } from "./index";

function stubRenderer(over: Partial<PdfRenderer> = {}): PdfRenderer {
  return {
    render: vi.fn().mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46])), // "%PDF"
    close: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe("pdf", () => {
  it("HTML から PDF バイナリを返す", async () => {
    const pdf = createPdf(stubRenderer());
    const res = await pdf.fromHtml("<h1>請求書</h1>");
    expect(res.ok).toBe(true);
    if (res.ok) expect(Array.from(res.value.slice(0, 4))).toEqual([0x25, 0x50, 0x44, 0x46]);
  });

  it("レンダラが失敗したら INTERNAL エラー", async () => {
    const pdf = createPdf(stubRenderer({ render: vi.fn().mockRejectedValue(new Error("boom")) }));
    const res = await pdf.fromHtml("<h1>x</h1>");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("INTERNAL");
  });
});
