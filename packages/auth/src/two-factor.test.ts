import { describe, it, expect } from "vitest";
import { availableMethods, isTwoFactorEnabled, verifyTwoFactor, verifyAnyTwoFactor } from "./two-factor.js";
import { generateTotpSecret, totp } from "./totp.js";
import { generateBackupCodes } from "./recovery-codes.js";
import { createOtpChallenge } from "./otp.js";
const secret = "pepper";
const now = new Date("2025-07-25T12:00:00Z");
describe("two-factor orchestration", () => {
  const totpSecret = generateTotpSecret();
  const { records: backupCodes, codes } = generateBackupCodes(secret);
  const config = { totpSecret, smsPhone: "+8190", backupCodes };
  it("reports enrolled methods", () => {
    expect(availableMethods(config).sort()).toEqual(["backup", "sms", "totp"]);
    expect(isTwoFactorEnabled({})).toBe(false);
  });
  it("verifies via TOTP and consumes backup codes", () => {
    expect(verifyTwoFactor(config, "totp", totp(totpSecret, {}, now), { now }).verified).toBe(true);
    const r = verifyTwoFactor(config, "backup", codes[0]!, { secret, now });
    expect(r.verified).toBe(true);
    expect(r.remainingBackupCodes).toBe(9);
    expect(verifyTwoFactor(r.config, "backup", codes[0]!, { secret, now }).verified).toBe(false);
  });
  it("verifies SMS challenge and clears it", () => {
    const { challenge, code } = createOtpChallenge("+8190", secret, { now });
    const r = verifyTwoFactor({ ...config, smsChallenge: challenge }, "sms", code, { secret, now });
    expect(r.verified).toBe(true);
    expect(r.config.smsChallenge).toBeUndefined();
  });
  it("auto-detects method", () => {
    expect(verifyAnyTwoFactor(config, totp(totpSecret, {}, now), { secret, now }).method).toBe("totp");
    expect(verifyAnyTwoFactor(config, codes[3]!, { secret, now }).method).toBe("backup");
    expect(verifyAnyTwoFactor(config, "999999", { secret, now }).verified).toBe(false);
  });
});
