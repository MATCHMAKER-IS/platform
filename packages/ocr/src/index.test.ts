import { describe, it, expect, vi } from "vitest";
import { createTesseractOcr, createHttpOcr } from "./index";
import { extractAmount, findRegistrationNumber, findPhone, parseJapaneseDate } from "./extraction";

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

describe("カンマをピリオドと誤読した金額", () => {
  // **OCR は `1,234` を `1.234` と読むことがある。**
  // そのままだと `.234` だけを拾って **234 円**になり、1,000 円少なく取り込まれる
  // ——経費精算なら過少申告、請求なら請求漏れ。
  // **金額が小さくなる方向**なので気づきにくい(2026-08 に対処)
  it("3 桁区切りのピリオドはカンマとみなす", () => {
    expect(extractAmount("1.234円")).toBe(1234);
    expect(extractAmount("合計 12.345円")).toBe(12345);
  });
  // **1〜2 桁の小数は変えない**(単価や数量の可能性がある)
  it("小数の数量は金額にしない", () => {
    expect(extractAmount("1.5個")).toBeNull();
  });
  // **正常な表記は従来どおり**(境界)
  it("カンマ区切りはそのまま", () => {
    expect(extractAmount("¥1,234")).toBe(1234);
  });
});

describe("紙の帳票の実態に合わせる", () => {
  // **元号は 1 文字で押されることが多い**(スタンプ・レシートの幅節約)。
  // 読めないと日付が空のまま取り込まれ、**計上月が決まらず手入力に戻る**
  it("和暦の漢字 1 文字略記を読む", () => {
    expect(parseJapaneseDate("令6.8.10")).toBe("2024-08-10");
    expect(parseJapaneseDate("平31-4-30")).toBe("2019-04-30");
  });
  // **全角の `Ｔ` と小文字の `t`。** OCR は書体で取り違える。
  // インボイス番号は必ず大文字なので、`t` で来たら直してよい
  it("登録番号の全角・小文字を読む", () => {
    expect(findRegistrationNumber("Ｔ1234567890123")).toBe("T1234567890123");
    expect(findRegistrationNumber("t1234567890123")).toBe("T1234567890123");
  });
  it("13 桁でなければ拾わない", () => {
    expect(findRegistrationNumber("T123456789012")).toBeNull();
  });
  // **FAX を電話番号として拾わない。** 領収書には TEL と FAX が並んでおり、
  // FAX を取り込むと**確認の電話がかからない**
  it("FAX 番号を電話として拾わない", () => {
    expect(findPhone("FAX 03-1234-5679")).toBeNull();
    expect(findPhone("FAX 03-1234-5679 TEL 03-1234-5678")).toBe("03-1234-5678");
  });
  // **全角のハイフン**(OCR は長音記号とも取り違える)
  it("全角の電話番号を読む", () => {
    expect(findPhone("０３－１２３４－５６７８")).toBe("03-1234-5678");
  });
  // **ハイフン無しも拾う**(レシートでは珍しくない)
  it("ハイフン無しの電話番号を読む", () => {
    expect(findPhone("TEL 0312345678")).toBe("0312345678");
  });
});
