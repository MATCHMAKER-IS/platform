import { describe, it, expect } from "vitest";
import { setSeed, japaneseName, email, phoneNumber, zipCode, seedMany } from "./index.js";

describe("faker", () => {
  it("シード固定で再現可能", () => {
    setSeed(1);
    const a = japaneseName();
    setSeed(1);
    const b = japaneseName();
    expect(a).toBe(b);
  });

  it("郵便番号は 123-4567 形式", () => {
    expect(zipCode()).toMatch(/^\d{3}-\d{4}$/);
  });

  it("seedMany は指定件数を作る", () => {
    const rows = seedMany(5, () => ({ name: japaneseName(), email: email(), tel: phoneNumber() }));
    expect(rows).toHaveLength(5);
    expect(rows[0]?.name).toBeTruthy();
  });
});
