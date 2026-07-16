import { describe, it, expect } from "vitest";
import { convertLength, convertWeight, convertArea, convertVolume, convertTemperature, round } from "./index";

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

describe("units", () => {
  it("length", () => { expect(convertLength(1, "m", "cm")).toBe(100); expect(near(convertLength(1, "in", "cm"), 2.54)).toBe(true); });
  it("weight", () => { expect(convertWeight(1, "kg", "g")).toBe(1000); expect(near(convertWeight(1, "lb", "kg"), 0.45359237)).toBe(true); });
  it("area (tsubo)", () => { expect(convertArea(1, "ha", "m2")).toBe(10000); expect(near(convertArea(1, "tsubo", "m2"), 3.305785)).toBe(true); });
  it("volume", () => { expect(convertVolume(1, "l", "ml")).toBe(1000); });
  it("temperature", () => { expect(convertTemperature(100, "C", "F")).toBe(212); expect(convertTemperature(-40, "C", "F")).toBe(-40); expect(near(convertTemperature(0, "C", "K"), 273.15)).toBe(true); });
  it("round", () => expect(round(2.34567, 2)).toBe(2.35));
});
