import { describe, it, expect } from "vitest";
import { issuesToFieldErrors, fieldError, hasNoErrors, formError } from "./errors.js";
describe("form errors", () => {
  it("maps issues to field errors", () => {
    const issues = [
      { path: "email", message: "メール形式が不正" },
      { path: "password", message: "8文字以上" },
      { path: "email", message: "必須" },
      { path: "", message: "全体エラー" },
    ];
    const fe = issuesToFieldErrors(issues);
    expect(fe.email).toBe("メール形式が不正");
    expect(fe.password).toBe("8文字以上");
    expect(fe._form).toBe("全体エラー");
    expect(issuesToFieldErrors([{ path: "address.zip", message: "郵便番号不正" }])["address.zip"]).toBe("郵便番号不正");
  });
  it("queries errors", () => {
    const fe = { email: "e", _form: "f" };
    expect(fieldError(fe, "email")).toBe("e");
    expect(fieldError(fe, "name")).toBeUndefined();
    expect(hasNoErrors({})).toBe(true);
    expect(hasNoErrors(fe)).toBe(false);
    expect(formError(fe)).toBe("f");
    expect(formError({ email: "e" })).toBeUndefined();
  });
});
