import { describe, it, expect } from "vitest";
import { runWithContext, getContext, getRequestId, setContextValue, bindLogger } from "./index.js";

describe("context", () => {
  it("コンテキスト内で requestId を採番・参照できる", () => {
    runWithContext({}, () => {
      expect(getRequestId()).toBeTruthy();
      expect(getContext()?.requestId).toBe(getRequestId());
    });
  });

  it("コンテキスト外では undefined", () => {
    expect(getContext()).toBeUndefined();
    expect(getRequestId()).toBeUndefined();
  });

  it("setContextValue で追記できる", () => {
    runWithContext({ requestId: "r1" }, () => {
      setContextValue("userId", "u1");
      expect(getContext()?.userId).toBe("u1");
    });
  });

  it("bindLogger はコンテキストを child に渡す", () => {
    const calls: Record<string, unknown>[] = [];
    const fakeLogger = { child: (b: Record<string, unknown>) => { calls.push(b); return fakeLogger; } };
    runWithContext({ requestId: "r2", userId: "u2" }, () => {
      bindLogger(fakeLogger);
    });
    expect(calls[0]).toMatchObject({ requestId: "r2", userId: "u2" });
  });
});
