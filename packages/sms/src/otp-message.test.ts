import { describe, it, expect } from "vitest";
import { buildOtpSms } from "./otp-message";
describe("OTP SMS message", () => {
  it("builds default and templated messages", () => {
    expect(buildOtpSms({ to: "+8190", code: "123456", appName: "社内", expiryMinutes: 5 }).body).toBe("【社内】認証コード: 123456(5分間有効)");
    expect(buildOtpSms({ to: "x", code: "9999" }).body).toBe("認証コード: 9999");
    expect(buildOtpSms({ to: "x", code: "55", appName: "A", expiryMinutes: 3, template: "{app}:{code}({minutes}分)" }).body).toBe("A:55(3分)");
  });
});
