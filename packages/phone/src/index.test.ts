import { describe, it, expect } from "vitest";
import { normalizePhone, phoneType, isValidJpPhone, toE164, fromE164, formatJpPhone, maskPhone } from "./index";

describe("jp phone", () => {
  it("normalize", () => { expect(normalizePhone("090-1234-5678")).toBe("09012345678"); expect(normalizePhone("＋８１ ９０ １２３４ ５６７８")).toBe("09012345678"); });
  it("type", () => { expect(phoneType("090-1234-5678")).toBe("mobile"); expect(phoneType("050-1234-5678")).toBe("ip"); expect(phoneType("0800-123-4567")).toBe("toll-free"); expect(phoneType("03-1234-5678")).toBe("landline"); expect(phoneType("12345")).toBe("unknown"); });
  it("valid", () => { expect(isValidJpPhone("090-1234-5678")).toBe(true); expect(isValidJpPhone("0901234")).toBe(false); });
  it("e164", () => { expect(toE164("090-1234-5678")).toBe("+819012345678"); expect(toE164("bad")).toBeNull(); expect(fromE164("+819012345678")).toBe("09012345678"); });
  it("format/mask", () => { expect(formatJpPhone("09012345678")).toBe("090-1234-5678"); expect(formatJpPhone("0312345678")).toBe("03-1234-5678"); expect(maskPhone("09012345678")).toBe("*******5678"); });
});
