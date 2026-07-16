import { describe, it, expect, vi } from "vitest";
import { createTesseractOcr, createHttpOcr } from "./index";

describe("createTesseractOcr", () => {
  it("結果をマッピング", async () => {
    const fake = { recognize: vi.fn(async () => ({ data: { text: "領収書", confidence: 92, words: [{ text: "領収書", confidence: 92 }] } })) };
    const ocr = createTesseractOcr(fake, { lang: "jpn" });
    const res = await ocr.recognize(new Uint8Array([1]));
    expect(res.ok && res.value.text).toBe("領収書");
    expect(res.ok && res.value.confidence).toBe(92);
  });
});

describe("createHttpOcr", () => {
  it("POST して parse", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ result: "abc" }) })) as unknown as typeof fetch;
    const ocr = createHttpOcr({ endpoint: "https://x/ocr", parse: (j: any) => ({ text: j.result }), fetch: fetchImpl });
    const res = await ocr.recognize(new Uint8Array([1]));
    expect(res.ok && res.value.text).toBe("abc");
  });
});
