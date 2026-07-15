import { describe, it, expect } from "vitest";
import { testId, fakeAuthUser, fakeSession, fixedDate } from "./factories.js";

describe("factories", () => {
  it("testId は毎回異なる", () => {
    expect(testId()).not.toBe(testId());
  });
  it("fakeAuthUser は上書きできる", () => {
    expect(fakeAuthUser({ roles: ["admin"] }).roles).toEqual(["admin"]);
  });
  it("fakeSession は既定でユーザーを持つ", () => {
    expect(fakeSession().user.id).toBeTruthy();
  });
  it("fixedDate は固定値", () => {
    expect(fixedDate().toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});
