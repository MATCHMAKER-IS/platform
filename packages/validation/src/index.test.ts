import { describe, it, expect } from "vitest";
import {
  validate, z, email, zipCodeJp, phoneJp, mobileJp, katakana, hiragana, prefecture,
  myNumber, corporateNumber, amount, agreement, requiredString,
  password, passwordWithConfirm, dateRange,
  toHalfWidth, digitsToHalfWidth, computeMyNumberCheckDigit,
} from "./index";

describe("validate", () => {
  it("成功時は ok", () => {
    expect(validate(z.object({ email }), { email: "a@example.co.jp" }).ok).toBe(true);
  });
  it("失敗時は VALIDATION エラー(issues 付き)", () => {
    const r = validate(z.object({ email }), { email: "bad" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("VALIDATION");
  });
});

describe("日本固有スキーマ", () => {
  it("郵便番号(全角も受理)", () => {
    expect(zipCodeJp.safeParse("123-4567").success).toBe(true);
    expect(zipCodeJp.safeParse("１２３４５６７").success).toBe(true);
    expect(zipCodeJp.safeParse("12-345").success).toBe(false);
  });
  it("電話・携帯", () => {
    expect(phoneJp.safeParse("03-1234-5678").success).toBe(true);
    expect(mobileJp.safeParse("090-1234-5678").success).toBe(true);
    expect(mobileJp.safeParse("03-1234-5678").success).toBe(false);
  });
  it("カナ", () => {
    expect(katakana.safeParse("ヤマダ タロウ").success).toBe(true);
    expect(hiragana.safeParse("やまだ たろう").success).toBe(true);
    expect(katakana.safeParse("やまだ").success).toBe(false);
  });
  it("都道府県", () => {
    expect(prefecture.safeParse("東京都").success).toBe(true);
    expect(prefecture.safeParse("東京").success).toBe(false);
  });
  it("マイナンバー・法人番号(チェックディジット)", () => {
    const cd = computeMyNumberCheckDigit("12345678901");
    expect(myNumber.safeParse(`12345678901${cd}`).success).toBe(true);
    expect(myNumber.safeParse("123456789010").success).toBe(false);
    expect(corporateNumber.safeParse("1180301018771").success).toBe(true); // トヨタ
    expect(corporateNumber.safeParse("1180301018770").success).toBe(false);
  });
});

describe("数値・同意", () => {
  it("金額は 0 以上の整数", () => {
    expect(amount.safeParse(1000).success).toBe(true);
    expect(amount.safeParse(-1).success).toBe(false);
    expect(amount.safeParse(1.5).success).toBe(false);
  });
  it("同意チェックは true 必須", () => {
    expect(agreement.safeParse(true).success).toBe(true);
    expect(agreement.safeParse(false).success).toBe(false);
  });
  it("requiredString は空文字を弾く", () => {
    expect(requiredString().safeParse("  ").success).toBe(false);
    expect(requiredString().safeParse(" 山田 ").success).toBe(true);
  });
});

describe("フォームパターン", () => {
  it("password は強度要件を課す", () => {
    const s = password({ minLength: 8 });
    expect(s.safeParse("Abcd1234").success).toBe(true);
    expect(s.safeParse("abcd1234").success).toBe(false); // 大文字なし
    expect(s.safeParse("Ab1").success).toBe(false);      // 短い
  });
  it("passwordWithConfirm は一致を検証", () => {
    const s = passwordWithConfirm();
    expect(s.safeParse({ password: "Abcd1234", confirmPassword: "Abcd1234" }).success).toBe(true);
    const bad = s.safeParse({ password: "Abcd1234", confirmPassword: "x" });
    expect(bad.success).toBe(false);
  });
  it("dateRange は開始≤終了を検証", () => {
    const s = dateRange();
    expect(s.safeParse({ start: "2026-01-01", end: "2026-01-31" }).success).toBe(true);
    expect(s.safeParse({ start: "2026-02-01", end: "2026-01-01" }).success).toBe(false);
  });
});

describe("transforms", () => {
  it("全角→半角", () => {
    expect(digitsToHalfWidth("１２３")).toBe("123");
    expect(toHalfWidth("ＡＢ１　ｃ")).toBe("AB1 c");
  });
});

import {
  alphanumeric, halfWidthKana, time, httpsUrl, creditCard, bankCode, branchCode, accountNumber,
  between, futureDate, pastDate, nonEmptyArray, fileConstraints,
} from "./index";

describe("追加パターン", () => {
  it("半角英数字・半角カナ", () => {
    expect(alphanumeric.safeParse("Abc123").success).toBe(true);
    expect(alphanumeric.safeParse("Abc 123").success).toBe(false);
    expect(halfWidthKana.safeParse("ﾔﾏﾀﾞ").success).toBe(true);
    expect(halfWidthKana.safeParse("ヤマダ").success).toBe(false);
  });
  it("時刻 HH:mm", () => {
    expect(time.safeParse("09:30").success).toBe(true);
    expect(time.safeParse("24:00").success).toBe(false);
    expect(time.safeParse("9:30").success).toBe(false);
  });
  it("https のみ", () => {
    expect(httpsUrl.safeParse("https://example.co.jp").success).toBe(true);
    expect(httpsUrl.safeParse("http://example.co.jp").success).toBe(false);
  });
  it("クレジットカード(Luhn)", () => {
    expect(creditCard.safeParse("4242 4242 4242 4242").success).toBe(true);
    expect(creditCard.safeParse("4242424242424241").success).toBe(false);
  });
  it("銀行コード・支店コード・口座番号", () => {
    expect(bankCode.safeParse("0001").success).toBe(true);
    expect(bankCode.safeParse("1").success).toBe(false);
    expect(branchCode.safeParse("123").success).toBe(true);
    expect(accountNumber.safeParse("1234567").success).toBe(true);
    expect(accountNumber.safeParse("123").success).toBe(false);
  });
  it("数値範囲・未来日・過去日", () => {
    expect(between(1, 10).safeParse(5).success).toBe(true);
    expect(between(1, 10).safeParse(11).success).toBe(false);
    expect(futureDate().safeParse("2999-01-01").success).toBe(true);
    expect(pastDate().safeParse("2000-01-01").success).toBe(true);
    expect(futureDate().safeParse("2000-01-01").success).toBe(false);
  });
  it("非空配列", () => {
    const s = nonEmptyArray(z.string());
    expect(s.safeParse(["a"]).success).toBe(true);
    expect(s.safeParse([]).success).toBe(false);
  });
  it("ファイル制約(サイズ・MIME)", () => {
    const s = fileConstraints({ maxSizeBytes: 1000, allowedMimeTypes: ["image/"] });
    expect(s.safeParse({ size: 500, type: "image/png" }).success).toBe(true);
    expect(s.safeParse({ size: 2000, type: "image/png" }).success).toBe(false); // 大きすぎ
    expect(s.safeParse({ size: 500, type: "application/pdf" }).success).toBe(false); // MIME 不許可
  });
});
