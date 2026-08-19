import { describe, it, expect } from "vitest";
import { randomBytes, scryptSync } from "node:crypto";
import { deriveKey, encrypt, decrypt, hashPassword, verifyPassword, randomToken } from "./index";

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

import { generatePassword, passwordStrength } from "./index";

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

describe("パスワードハッシュのコストと互換", () => {
  // **コストを文字列に含める。** 含めないと、後で上げたときに
  // 保存済みハッシュを検証できず**全員ログイン不能**になる
  it("形式にコストが入る", () => {
    expect(hashPassword("pw")).toMatch(/^scrypt\$\d+\$/);
  });
  it("新形式を検証できる", () => {
    const h = hashPassword("pw123");
    expect(verifyPassword("pw123", h)).toBe(true);
    expect(verifyPassword("wrong", h)).toBe(false);
  });
  // **旧形式(`salt:hash`)も検証できる。** 利用者が次にパスワードを
  // 変えるまで旧形式のまま残るので、この経路は消さない
  it("旧形式も検証できる", () => {
    const salt = randomBytes(16);
    const old = `${salt.toString("base64")}:${scryptSync("pw123", salt, 64).toString("base64")}`;
    expect(verifyPassword("pw123", old)).toBe(true);
    expect(verifyPassword("wrong", old)).toBe(false);
  });
  // **壊れた入力で例外を投げない**(境界)
  it("形式が違えば false", () => {
    expect(verifyPassword("pw", "こわれた")).toBe(false);
    expect(verifyPassword("pw", "scrypt$abc$x$y")).toBe(false);
  });
});
