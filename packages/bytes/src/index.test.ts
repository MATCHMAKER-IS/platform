import { describe, expect, it } from "vitest";

import {
  base64ToBytes,
  bytesToBase64,
  bytesToBase64Url,
  bytesToHex,
  bytesToText,
  decodeBase64,
  encodeBase64,
  encodeBase64Url,
  formatByteSize,
  hexToBytes,
  textToBytes,
  matchesDeclaredType,
  sniffMimeType,
  timingSafeEqualBytes,
} from "./index";

describe("base64", () => {
  it("日本語を往復できる（btoa は例外を投げる入力）", () => {
    // **`btoa("経費")` は Invalid character で落ちる。**
    // 12 パッケージが自前で回避策を書いていたのを、ここに寄せた
    expect(encodeBase64("経費")).toBe("57WM6LK7");
    expect(decodeBase64("57WM6LK7")).toBe("経費");
  });

  it("絵文字も往復できる（サロゲートペア）", () => {
    const text = "領収書📄です";
    expect(decodeBase64(encodeBase64(text))).toBe(text);
  });

  it("空文字も扱える", () => {
    expect(encodeBase64("")).toBe("");
    expect(decodeBase64("")).toBe("");
  });

  it("壊れた入力は undefined（例外を投げない）", () => {
    // **外から来る値なので、try/catch を書き忘れても落ちない形にしてある**
    expect(decodeBase64("!!!!")).toBeUndefined();
  });
});

describe("base64url", () => {
  it("URL に入れて壊れない文字だけになる", () => {
    // **`+` `/` `=` が入ると URL で壊れる**（`+` が空白になる・`/` が区切りになる）
    const bytes = new Uint8Array([251, 255, 190]);
    expect(bytesToBase64(bytes)).toContain("/");
    const url = bytesToBase64Url(bytes);
    expect(url).not.toMatch(/[+/=]/);
  });

  it("base64url を base64 として読み戻せる", () => {
    const text = "経費精算";
    expect(decodeBase64(encodeBase64Url(text))).toBe(text);
  });

  it("パディングが無くても復元できる", () => {
    expect(decodeBase64("57WM6LK7")).toBe("経費");
    expect(decodeBase64("YQ")).toBe("a"); // 本来は "YQ=="
  });
});

describe("バイナリ", () => {
  it("バイト列を往復できる", () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255]);
    expect([...base64ToBytes(bytesToBase64(bytes))]).toEqual([...bytes]);
  });

  it("大きな入力でも落ちない（fromCharCode の引数上限）", () => {
    // **`String.fromCharCode(...bytes)` は数 MB で RangeError になる。**
    // 1 文字ずつ足す実装にしてある
    const big = new Uint8Array(200_000).fill(65);
    expect(bytesToBase64(big).length).toBeGreaterThan(100_000);
  });

  it("壊れたバイト列は置換文字になる（例外を投げない）", () => {
    // **途中で切れた添付を表示しようとして、画面ごと落ちるより読めない文字が出る方がよい**
    const broken = new Uint8Array([0xe7, 0xb5]); // 3 バイト文字の途中
    expect(bytesToText(broken)).toContain("\uFFFD");
  });
});

describe("hex", () => {
  it("往復できる", () => {
    const bytes = textToBytes("経費");
    expect(hexToBytes(bytesToHex(bytes))).toEqual(bytes);
  });

  it("大文字小文字を問わない", () => {
    expect([...hexToBytes("AB")]).toEqual([...hexToBytes("ab")]);
  });

  it("奇数長は例外（黙って途中まで読まない）", () => {
    // **署名の比較で使うので、途中まで読むと通ってしまう**
    expect(() => hexToBytes("abc")).toThrow();
  });

  it("16 進でない文字は例外", () => {
    expect(() => hexToBytes("zz")).toThrow();
  });
});

describe("timingSafeEqualBytes", () => {
  it("同じなら true", () => {
    expect(timingSafeEqualBytes(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
  });

  it("違えば false", () => {
    expect(timingSafeEqualBytes(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
  });

  it("長さが違えば false（長さは秘密ではない）", () => {
    expect(timingSafeEqualBytes(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false);
  });

  it("先頭が違っても最後まで比べる（時間を一定にする）", () => {
    // **普通の比較は違いが見つかった時点で止まるので、
    // 応答時間から「何文字目まで合っていたか」が漏れる**
    const a = new Uint8Array(1000).fill(1);
    const b = new Uint8Array(1000).fill(1);
    b[0] = 2;
    expect(timingSafeEqualBytes(a, b)).toBe(false);
  });
});

describe("formatByteSize", () => {
  it("1024 基準で表示する", () => {
    expect(formatByteSize(0)).toBe("0 B");
    expect(formatByteSize(1023)).toBe("1023 B");
    expect(formatByteSize(1024)).toBe("1.0 KB");
    expect(formatByteSize(1_572_864)).toBe("1.5 MB");
  });

  it("不正な値は — を返す", () => {
    expect(formatByteSize(Number.NaN)).toBe("—");
    expect(formatByteSize(-1)).toBe("—");
  });
});

describe("sniffMimeType", () => {
  it("先頭のバイトで種類が分かる", () => {
    expect(sniffMimeType(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe("application/pdf");
    expect(sniffMimeType(new Uint8Array([0xff, 0xd8, 0xff]))).toBe("image/jpeg");
  });

  it("知らない形式は undefined（判定できないものは通す）", () => {
    expect(sniffMimeType(new Uint8Array([1, 2, 3]))).toBeUndefined();
    expect(sniffMimeType(new Uint8Array([]))).toBeUndefined();
  });

  it("xlsx / docx は ZIP に見える（中を開くまで区別できない）", () => {
    expect(sniffMimeType(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe("application/zip");
  });
});

describe("matchesDeclaredType", () => {
  it("名乗りと中身が違えば false", () => {
    // **`Content-Type` は送る側が名乗るだけで詐称できる**
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(matchesDeclaredType(png, "application/pdf")).toBe(false);
  });

  it("判定できない形式は通す（テキスト・CSV など）", () => {
    expect(matchesDeclaredType(new Uint8Array([65, 66]), "text/csv")).toBe(true);
  });

  it("ZIP を土台にした形式は allowZipBased で許す", () => {
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    const xlsx = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    expect(matchesDeclaredType(zip, xlsx)).toBe(false);
    expect(matchesDeclaredType(zip, xlsx, { allowZipBased: true })).toBe(true);
  });
});
