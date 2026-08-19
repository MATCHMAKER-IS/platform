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
    // **DATABASE は 503**(`@platform/core` の `ERROR_POLICY` が正)。
    // 一時的な失敗として再試行してよい、という意味を持たせている。
    // 500 と書いてあったのは、この方針を決める前の名残。
    expect(status).toBe(503);
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

// **400 系は開発者の文言がそのまま画面に出ていた**(2026-08 に修正)
describe("toHttpError の利用者向け文言", () => {
  it("内部の詳細を利用者向け文言に混ぜない", () => {
    const { body } = toHttpError(new AppError(ErrorCode.DATABASE, "P2002 unique constraint on ItemRow.code"));
    expect(body.error.userMessage.title).not.toContain("P2002");
    expect(body.error.userMessage.title).not.toContain("ItemRow");
    // **`message` は残す。** ログとの突き合わせに要る
    expect(body.error.message).toBeTypeOf("string");
  });

  it("入力の誤りには「次にすること」がある", () => {
    const { body } = toHttpError(new AppError(ErrorCode.VALIDATION, "zod failed"));
    expect(body.error.userMessage.action.length).toBeGreaterThan(10);
    expect(body.error.userMessage.recoverable).toBe(true);
  });

  // **押しても直らないボタンを出さないため**
  it("権限不足は recoverable: false", () => {
    const { body } = toHttpError(new AppError(ErrorCode.FORBIDDEN, "no"));
    expect(body.error.userMessage.recoverable).toBe(false);
  });
});
