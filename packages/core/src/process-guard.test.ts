import { describe, it, expect } from "vitest";
import { installProcessGuards } from "./process-guard";
describe("process guard", () => {
  it("logs rejections, exits on uncaught after onFatal", async () => {
    const handlers: Record<string, (...a: unknown[]) => void> = {};
    let exitCode: number | null = null; let fatal = false; const logs: string[] = [];
    installProcessGuards({
      logger: { error: (_o, m) => logs.push(m ?? ""), warn: () => {} },
      onProcess: (e, h) => { handlers[e] = h; }, exit: (c) => { exitCode = c; }, onFatal: () => { fatal = true; },
    });
    handlers.unhandledRejection!(new Error("r"));
    expect(exitCode).toBeNull();
    handlers.uncaughtException!(new Error("f"));
    await new Promise((r) => setTimeout(r, 10));
    expect(fatal).toBe(true); expect(exitCode).toBe(1);
  });
});
