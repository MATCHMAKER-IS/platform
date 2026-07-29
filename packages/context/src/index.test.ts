import { describe, it, expect } from "vitest";
import { runWithContext, getContext, getRequestId, setContextValue, bindLogger } from "./index";

describe("context", () => {
  it("コンテキスト内で requestId を採番・参照できる", () => {
    runWithContext({}, () => {
      expect(getRequestId()).toBeTruthy();
      expect(getContext()?.requestId).toBe(getRequestId());
    });
  });

  it("requestId に undefined を渡しても採番される(スプレッド順の回帰)", () => {
    // 「有るかもしれない値」をそのまま渡す形。実際にアプリ側でこれを書き、
    // 採番結果が undefined で上書きされて相関 ID が消えた
    const fromHeader: string | undefined = undefined;
    runWithContext({ requestId: fromHeader }, () => {
      expect(getRequestId()).toBeTruthy();
      expect(getContext()?.requestId).toBe(getRequestId());
    });
  });

  it("明示した requestId は採番より優先される", () => {
    runWithContext({ requestId: "given-id" }, () => {
      expect(getRequestId()).toBe("given-id");
    });
  });

  it("requestId を採番しても他のキーは保たれる", () => {
    runWithContext({ userId: "u9", tenant: "t1" }, () => {
      expect(getRequestId()).toBeTruthy();
      expect(getContext()?.userId).toBe("u9");
      expect(getContext()?.tenant).toBe("t1");
    });
  });

  it("採番はリクエストごとに異なる", () => {
    const ids: (string | undefined)[] = [];
    runWithContext({}, () => ids.push(getRequestId()));
    runWithContext({}, () => ids.push(getRequestId()));
    expect(ids[0]).toBeTruthy();
    expect(ids[0]).not.toBe(ids[1]);
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
