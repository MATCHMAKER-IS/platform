import { describe, it, expect } from "vitest";
import { toHttpError, resultToResponse } from "./index";
import { AppError, ErrorCode, ok, err } from "@platform/core";

describe("toHttpError", () => {
  it("コードごとに正しいステータスを返す", () => {
    expect(toHttpError(new AppError(ErrorCode.VALIDATION, "x")).status).toBe(400);
    expect(toHttpError(new AppError(ErrorCode.FORBIDDEN, "x")).status).toBe(403);
    expect(toHttpError(new AppError(ErrorCode.NOT_FOUND, "x")).status).toBe(404);
  });

  it("500系は内部詳細を隠す", () => {
    const { status, body } = toHttpError(new AppError(ErrorCode.DATABASE, "生SQL失敗"));
    expect(status).toBe(500);
    expect(body.error.message).not.toContain("生SQL");
  });
});

describe("resultToResponse", () => {
  it("ok は 200 を返す", async () => {
    const res = resultToResponse(ok({ id: 1 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 1 });
  });

  it("err は対応ステータスを返す", () => {
    const res = resultToResponse(err(new AppError(ErrorCode.NOT_FOUND, "なし")));
    expect(res.status).toBe(404);
  });
});
