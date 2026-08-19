import { describe, it, expect } from "vitest";
import { buildZenginTransfer, toHankakuKana, buildDataRecord, buildTrailer, toShiftJisBytes, findUnsupportedChars, type TransferRecord } from "./index";
const consignor = { code: "1234567890", name: "テスト", bankCode: "0001", branchCode: "001", accountType: "1" as const, accountNumber: "1234567" };
const records = [{ bankCode: "0005", branchCode: "100", accountType: "1" as const, accountNumber: "7654321", recipientName: "ヤマダタロウ", amount: 150000 }];
describe("zengin", () => {
  it("builds transfer with correct record types", () => {
    const r = buildZenginTransfer(consignor, records, "0725");
    const lines = r.content.split("\r\n");
    expect(lines[0]![0]).toBe("1");
    expect(lines[1]![0]).toBe("2");
    expect(lines[2]![0]).toBe("8");
    // **エンドレコードも 120 桁固定**(残りはスペース)。
    // 銀行のシステムは固定長で読むので、詰めて出すと桁がずれる
    expect(lines[3]![0]).toBe("9");
    expect(lines[3]).toHaveLength(120);
    expect(r.totalAmount).toBe(150000);
  });
  it("converts kana and validates amount", () => {
    expect(toHankakuKana("ダ")).toBe("ﾀﾞ");
    expect(() => buildDataRecord({ ...records[0]!, amount: -1 })).toThrow();
  });
});

describe("桁あふれ: 黙って切り詰めない", () => {
  // **下位桁だけ残すと、別の金額として銀行に届く。**
  // 合計 1,234,567,890,123 円が 234,567,890,123 円になっていた(2026-08 に修正)
  it("合計金額が 12 桁を超えたら例外", () => {
    expect(() => buildTrailer(1, 1234567890123)).toThrow();
  });
  it("件数が 6 桁を超えたら例外", () => {
    expect(() => buildTrailer(1234567, 1000)).toThrow();
  });
  // **収まる値はゼロ埋めする。** レコード全体は **120 桁固定**
  // (2026-08 に 19 桁 → 120 桁へ。銀行は固定長で読む)
  it("収まる値はゼロ埋めする", () => {
    const line = buildTrailer(12, 3456);
    expect(line.slice(0, 19)).toBe("8" + "000012" + "000000003456");
    expect(line).toHaveLength(120);
  });
  // **ちょうど桁数いっぱいは通す**(境界)
  it("桁数ちょうどは通る", () => {
    const line = buildTrailer(999999, 999999999999);
    expect(line.slice(0, 19)).toBe("8999999999999999999");
    expect(line).toHaveLength(120);
  });
});

describe("データレコードは 120 桁固定", () => {
  // **`accountType` はリテラル型**(`"1" | "2" | "4"`)。型注釈が無いと
  // `string` に広がって代入できない(2026-08、型検査で判明)
  const base: TransferRecord = { bankCode: "0001", branchCode: "001", accountType: "1",
    accountNumber: "1234567", recipientName: "ヤマダタロウ", amount: 10000 };

  // **全国銀行協会の標準は 120 桁。** 2026-08 まで主要項目だけを並べて
  // **55 桁しか出ておらず**、TSDoc は「120 バイト」と書いていた
  // ——**銀行に持ち込んでも受け付けられない**ファイルができる
  it("120 桁になる", () => {
    expect(buildDataRecord(base).length).toBe(120);
  });
  // **任意項目を入れても桁は変わらない**(固定長なので)
  it("任意項目を入れても 120 桁", () => {
    const rec = buildDataRecord({ ...base, bankName: "ミズホ", branchName: "トウキョウ", customerCode1: "A001" });
    expect(rec.length).toBe(120);
  });
  // **データ区分は "2"**(ヘッダ 1 / データ 2 / トレーラ 8 / エンド 9)
  it("先頭がデータ区分 2", () => {
    expect(buildDataRecord(base)[0]).toBe("2");
  });
});

describe("Shift_JIS で書き出せる形にする", () => {
  // **小書きカナが変換表から漏れていた。** 「ｷｬﾉﾝ」「ｼｮｳｼﾞ」のような社名で
  // 変換されずに残り、**ファイル生成の直前まで気づけなかった**(2026-08)
  it("小書きカナを変換する", () => {
    expect(toHankakuKana("キャノン")).toBe("ｷｬﾉﾝ");
    expect(toHankakuKana("トッキュウ")).toBe("ﾄｯｷｭｳ");
  });
  // **文字列のまま書くと UTF-8 で 3 倍になる。**
  // 120 桁の行が 360 バイト近くになり、銀行のシステムが桁位置で切り出せない
  it("半角カナは 1 文字 1 バイト", () => {
    const kana = toHankakuKana("ヤマダタロウ");
    expect(toShiftJisBytes(kana).length).toBe(kana.length);
    expect(Buffer.from(kana, "utf8").length).toBeGreaterThan(kana.length);
  });
  // **使えない文字は黙って置き換えない。** `?` にすると
  // **受取人名が変わったまま振り込まれる**(別人の口座・組戻し)
  it("使えない文字で例外", () => {
    expect(() => toShiftJisBytes("山田太郎")).toThrow();
  });
  // **登録の時点で気づけるように**(振込当日に慌てない)
  it("使えない文字を先に見つけられる", () => {
    expect(findUnsupportedChars(toHankakuKana("ヤマダ"))).toEqual([]);
    expect(findUnsupportedChars("ヶ丘")).toContain("ヶ");
  });
});
