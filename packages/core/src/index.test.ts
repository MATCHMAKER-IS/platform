import { describe, it, expect } from "vitest";
import { AppError, ErrorCode, ok, err, tryCatch } from "./index";

describe("AppError", () => {
  it("保持したコードとメッセージを返す", () => {
    const e = new AppError(ErrorCode.NOT_FOUND, "なし", { details: { id: 1 } });
    expect(e.code).toBe("NOT_FOUND");
    expect(e.toJSON()).toMatchObject({ code: "NOT_FOUND", message: "なし" });
  });

  it("from() は素の Error を包む", () => {
    const e = AppError.from(new Error("boom"), ErrorCode.EXTERNAL);
    expect(e).toBeInstanceOf(AppError);
    expect(e.code).toBe("EXTERNAL");
  });
});

describe("Result / tryCatch", () => {
  it("成功時は ok を返す", async () => {
    const r = await tryCatch(async () => 42);
    expect(r).toEqual(ok(42));
  });

  it("例外時は AppError の err を返す", async () => {
    const r = await tryCatch(async () => {
      throw new Error("fail");
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeInstanceOf(AppError);
  });

  it("err ヘルパーは失敗を作る", () => {
    const r = err(new AppError(ErrorCode.INTERNAL, "x"));
    expect(r.ok).toBe(false);
  });
});
