import { describe, it, expect } from "vitest";
import { securityHeaders, sanitize, stripHtml } from "./index";

describe("security headers", () => {
  it("主要ヘッダを含む", () => {
    const h = securityHeaders();
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(h["Strict-Transport-Security"]).toBeTruthy();
  });

  it("HSTS を無効化できる", () => {
    expect(securityHeaders({ hsts: false })["Strict-Transport-Security"]).toBeUndefined();
  });
});

describe("sanitize", () => {
  it("script タグを除去する", () => {
    const out = sanitize('<p>ok</p><script>alert(1)</script>');
    expect(out).toContain("<p>ok</p>");
    expect(out).not.toContain("script");
  });

  it("onerror などの属性を除去する", () => {
    const out = sanitize('<img src=x onerror="alert(1)">');
    expect(out).not.toContain("onerror");
  });

  it("stripHtml は全タグを除去する", () => {
    expect(stripHtml("<b>太字</b>テキスト")).toBe("太字テキスト");
  });
});

import { createCsrf } from "./index";

describe("csrf", () => {
  const csrf = createCsrf({ secret: "test-secret-value" });

  it("発行したトークンは検証を通る(cookie とフォーム一致)", () => {
    const t = csrf.issue();
    expect(csrf.verify(t, t)).toBe(true);
  });
  it("cookie と送信が不一致なら拒否", () => {
    expect(csrf.verify(csrf.issue(), csrf.issue())).toBe(false);
  });
  it("署名が改ざんされたら拒否", () => {
    const t = csrf.issue();
    const tampered = t.slice(0, -3) + "000";
    expect(csrf.verify(tampered, tampered)).toBe(false);
  });
  it("別の秘密鍵で発行されたトークンは拒否", () => {
    const other = createCsrf({ secret: "different-secret" }).issue();
    expect(csrf.verify(other, other)).toBe(false);
  });
  it("空は拒否", () => {
    expect(csrf.verify(null, null)).toBe(false);
  });
});
