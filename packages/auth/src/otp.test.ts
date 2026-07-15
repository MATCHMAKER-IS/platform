import { describe, it, expect } from "vitest";
import { generateOtpCode, hashOtpCode, createOtpChallenge, verifyOtpCode, canResendOtp, resendWaitSeconds } from "./otp.js";
const secret = "pepper";
const now = new Date("2025-07-25T12:00:00Z");
describe("OTP auth", () => {
  it("generates codes and hashes without plaintext", () => {
    expect(generateOtpCode()).toMatch(/^\d{6}$/);
    expect(generateOtpCode(4)).toMatch(/^\d{4}$/);
    expect(hashOtpCode("123456", secret)).not.toBe("123456");
    expect(hashOtpCode("1", secret, "a")).not.toBe(hashOtpCode("1", secret, "b"));
  });
  it("creates and verifies challenges with attempts/expiry", () => {
    const { challenge, code } = createOtpChallenge("0901234", secret, { now, ttlSec: 300, maxAttempts: 3 });
    expect(JSON.stringify(challenge)).not.toContain(code);
    expect(verifyOtpCode(challenge, code, secret, now).status).toBe("ok");
    expect(verifyOtpCode(challenge, "000000", secret, now).status).toBe("invalid");
    expect(verifyOtpCode(challenge, code, secret, new Date(now.getTime() + 400_000)).status).toBe("expired");
    expect(verifyOtpCode({ ...challenge, attempts: 3, maxAttempts: 3 }, code, secret, now).status).toBe("too_many_attempts");
  });
  it("enforces resend cooldown", () => {
    const { challenge } = createOtpChallenge("x", secret, { now });
    expect(canResendOtp(challenge, 60, new Date(now.getTime() + 30_000))).toBe(false);
    expect(canResendOtp(challenge, 60, new Date(now.getTime() + 61_000))).toBe(true);
    expect(resendWaitSeconds(challenge, 60, new Date(now.getTime() + 20_000))).toBe(40);
  });
});
