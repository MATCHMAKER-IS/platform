import { describe, it, expect } from "vitest";
import { deriveKey, encrypt, decrypt, hashPassword, verifyPassword, randomToken } from "./index.js";

describe("crypto", () => {
  const key = deriveKey("super-secret-value-for-tests", "test-salt-unique");

  it("暗号化→復号で元に戻る", () => {
    const enc = encrypt("マイナンバー1234", key);
    expect(enc).not.toContain("マイナンバー");
    expect(decrypt(enc, key)).toBe("マイナンバー1234");
  });

  it("改ざんされた暗号文は復号に失敗する", () => {
    const enc = encrypt("secret", key);
    const tampered = enc.slice(0, -2) + "00";
    expect(() => decrypt(tampered, key)).toThrow();
  });

  it("パスワードのハッシュと検証", () => {
    const h = hashPassword("p@ssw0rd");
    expect(verifyPassword("p@ssw0rd", h)).toBe(true);
    expect(verifyPassword("wrong", h)).toBe(false);
  });

  it("randomToken は毎回異なる", () => {
    expect(randomToken()).not.toBe(randomToken());
  });
});

import { generatePassword, passwordStrength } from "./index.js";

describe("password utilities", () => {
  it("生成: 指定長・全文字種を含む・曖昧文字を除外", () => {
    const pw = generatePassword({ length: 20 });
    expect(pw).toHaveLength(20);
    expect(/[A-Z]/.test(pw)).toBe(true);
    expect(/[a-z]/.test(pw)).toBe(true);
    expect(/[0-9]/.test(pw)).toBe(true);
    expect(/[^A-Za-z0-9]/.test(pw)).toBe(true);
    expect(/[0O1lI]/.test(generatePassword({ length: 100 }))).toBe(false);
  });

  it("生成: 毎回異なる", () => {
    expect(generatePassword()).not.toBe(generatePassword());
  });

  it("生成: 文字種ゼロは例外", () => {
    expect(() => generatePassword({ uppercase: false, lowercase: false, numbers: false, symbols: false })).toThrow();
  });

  it("強度: 弱い/強いを区別する", () => {
    expect(passwordStrength("password").score).toBe(0);
    expect(passwordStrength("X9#mK2$vLp8qWz").score).toBe(4);
    expect(passwordStrength("Summer2024").score).toBeGreaterThanOrEqual(2);
  });

  it("強度: 改善ヒントを返す", () => {
    expect(passwordStrength("abc").suggestions.length).toBeGreaterThan(0);
  });
});
