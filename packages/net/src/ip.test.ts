import { describe, it, expect } from "vitest";
import { isValidIpv4, ipToLong, longToIp, ipInCidr, isPrivateIp, parseCidr } from "./ip";

describe("ip/cidr", () => {
  it("valid", () => { expect(isValidIpv4("192.168.1.1")).toBe(true); expect(isValidIpv4("256.1.1.1")).toBe(false); });
  it("round-trip", () => expect(longToIp(ipToLong("10.20.30.40")!)).toBe("10.20.30.40"));
  it("cidr", () => { expect(ipInCidr("10.1.2.3", "10.0.0.0/8")).toBe(true); expect(ipInCidr("192.168.2.1", "192.168.1.0/24")).toBe(false); });
  it("private", () => { expect(isPrivateIp("192.168.0.1")).toBe(true); expect(isPrivateIp("8.8.8.8")).toBe(false); });
  it("cidr /0", () => expect(parseCidr("0.0.0.0/0")!.mask).toBe(0));
});
