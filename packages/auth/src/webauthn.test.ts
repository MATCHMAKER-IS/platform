import { describe, it, expect } from "vitest";
import { generateKeyPairSync, sign, createHash, randomBytes } from "node:crypto";
import { toBase64Url, fromBase64Url, generateWebAuthnChallenge, webAuthnRegistrationOptions, webAuthnAuthenticationOptions, verifyClientData, parseAuthenticatorData, verifyRpIdHash, isSignCountValid, verifyAssertionSignature } from "./webauthn.js";
describe("webauthn / passkey", () => {
  it("round-trips base64url and builds options", () => {
    const b = new Uint8Array([1, 2, 250, 255]);
    expect(Array.from(fromBase64Url(toBase64Url(b)))).toEqual([1, 2, 250, 255]);
    expect(generateWebAuthnChallenge()).not.toBe(generateWebAuthnChallenge());
    const reg = webAuthnRegistrationOptions({ rpId: "x.com", rpName: "X", userId: "u1", userName: "a" });
    expect((reg.pubKeyCredParams as { alg: number }[]).some((p) => p.alg === -7)).toBe(true);
    expect((webAuthnAuthenticationOptions({ rpId: "x.com" }) as { rpId: string }).rpId).toBe("x.com");
  });
  it("verifies clientData (type/challenge/origin)", () => {
    const ch = generateWebAuthnChallenge();
    const cd = toBase64Url(new TextEncoder().encode(JSON.stringify({ type: "webauthn.get", challenge: ch, origin: "https://x.com" })));
    expect(verifyClientData(cd, { challenge: ch, origin: "https://x.com", type: "webauthn.get" }).valid).toBe(true);
    expect(verifyClientData(cd, { challenge: "no", origin: "https://x.com", type: "webauthn.get" }).valid).toBe(false);
    expect(verifyClientData(cd, { challenge: ch, origin: "https://evil.com", type: "webauthn.get" }).valid).toBe(false);
  });
  it("parses authenticatorData and verifies real signature", () => {
    const rpIdHash = createHash("sha256").update("x.com").digest();
    const authData = Buffer.concat([rpIdHash, Buffer.from([0x05]), Buffer.from([0, 0, 0, 42])]);
    const parsed = parseAuthenticatorData(new Uint8Array(authData));
    expect(parsed.flags.userVerified).toBe(true);
    expect(parsed.signCount).toBe(42);
    expect(verifyRpIdHash(new Uint8Array(authData), "x.com")).toBe(true);
    expect(isSignCountValid(42, 43)).toBe(true);
    expect(isSignCountValid(42, 42)).toBe(false);
    const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256", publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
    const cd = toBase64Url(new TextEncoder().encode("{}"));
    const signed = Buffer.concat([new Uint8Array(authData), createHash("sha256").update(Buffer.from(fromBase64Url(cd))).digest()]);
    const sig = toBase64Url(new Uint8Array(sign("sha256", signed, privateKey)));
    expect(verifyAssertionSignature({ publicKeyPem: publicKey, authenticatorData: new Uint8Array(authData), clientDataJSONBase64Url: cd, signatureBase64Url: sig })).toBe(true);
    expect(verifyAssertionSignature({ publicKeyPem: publicKey, authenticatorData: new Uint8Array(authData), clientDataJSONBase64Url: cd, signatureBase64Url: toBase64Url(randomBytes(64)) })).toBe(false);
  });
});
