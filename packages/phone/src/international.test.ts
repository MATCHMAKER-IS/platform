import { describe, it, expect } from "vitest";
import { isValidE164, parseE164, detectCountry, toE164International } from "./international.js";

describe("international phone", () => {
  it("validate", () => { expect(isValidE164("+819012345678")).toBe(true); expect(isValidE164("09012345678")).toBe(false); });
  it("parse JP/US", () => { expect(parseE164("+81 90-1234-5678")).toMatchObject({ country: "JP", callingCode: "81", nationalNumber: "9012345678" }); expect(parseE164("+14155552671")?.country).toBe("US"); });
  it("longest match", () => { expect(parseE164("+886912345678")?.country).toBe("TW"); });
  it("detect/unknown", () => { expect(detectCountry("+819012345678")).toBe("JP"); expect(detectCountry("+9991234")).toBeNull(); });
  it("build", () => expect(toE164International("81", "090-1234-5678")).toBe("+819012345678"));
});

import { internationalPhoneType } from "./international.js";
describe("international phone type", () => {
  it("mobile/landline/fixed_or_mobile", () => {
    expect(internationalPhoneType("+819012345678")).toBe("mobile");
    expect(internationalPhoneType("+81312345678")).toBe("landline");
    expect(internationalPhoneType("+442071234567")).toBe("landline");
    expect(internationalPhoneType("+447911123456")).toBe("mobile");
    expect(internationalPhoneType("+14155552671")).toBe("fixed_or_mobile");
    expect(internationalPhoneType("+5511987654321")).toBe("unknown");
  });
});
