import { describe, it, expect } from "vitest";
import { parseText, parseUint8, parseUint16, toBytes, encodeText, isBluetoothSupported, GATT } from "./index.js";

const dv = (bytes: number[]) => new DataView(new Uint8Array(bytes).buffer);

describe("parse", () => {
  it("parseUint8 / parseUint16(LE)", () => {
    expect(parseUint8(dv([0x2a]))).toBe(42);
    expect(parseUint16(dv([0x01, 0x02]), 0, true)).toBe(0x0201);
    expect(parseUint16(dv([0x01, 0x02]), 0, false)).toBe(0x0102);
  });
  it("parseText / encodeText 往復", () => {
    const buf = encodeText("温度");
    expect(parseText(new DataView(buf))).toBe("温度");
  });
  it("toBytes", () => {
    expect(toBytes(dv([1, 2, 255]))).toEqual([1, 2, 255]);
  });
  it("GATT 定数", () => {
    expect(GATT.batteryLevel).toBe("battery_level");
  });
});

describe("isBluetoothSupported", () => {
  it("navigator 無し環境では false", () => {
    expect(isBluetoothSupported()).toBe(false);
  });
});
