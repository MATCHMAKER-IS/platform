import { describe, it, expect } from "vitest";
import { isEmailLike, validateEmailLogin, isLoginFormValid } from "./login-form.js";
describe("ui login-form validation", () => {
  it("validates email format", () => {
    expect(isEmailLike("a@x.com")).toBe(true);
    expect(isEmailLike("bad")).toBe(false);
    expect(isEmailLike("a@b")).toBe(false);
  });
  it("validates login input", () => {
    expect(validateEmailLogin("", "password1").email).toContain("入力");
    expect(validateEmailLogin("bad", "password1").email).toContain("形式");
    expect(validateEmailLogin("a@x.com", "").password).toContain("入力");
    expect(validateEmailLogin("a@x.com", "abc").password).toContain("8文字以上");
    expect(validateEmailLogin("a@x.com", "abc", { minPasswordLength: 3 }).password).toBeUndefined();
    expect(Object.keys(validateEmailLogin("a@x.com", "password1"))).toHaveLength(0);
    expect(isLoginFormValid({})).toBe(true);
    expect(isLoginFormValid({ email: "x" })).toBe(false);
  });
});
