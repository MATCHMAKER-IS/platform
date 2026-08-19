import { describe, it, expect } from "vitest";
import { ErrorCode } from "@platform/core";
import { mapPrismaError, isRetryablePrismaError, isStatementTimeout } from "./errors";

/**
 * `statement_timeout`(PostgreSQL の `57014`)の扱いを固定する。
 *
 * **ここが崩れると、実害の出方が変わる。**
 * 打ち切られたクエリが `ErrorCode.DATABASE`(`retryable: true`)に丸められると、
 * `withRetry` 系が**同じ重いクエリを投げ直す**——30 秒 × リトライ回数を
 * 既に苦しんでいる DB へ押し付けることになる。
 *
 * 2026-08 まで実際にこの状態だった(`default` 節が全部 DATABASE にしていた)。
 */
describe("statement_timeout(57014)の扱い", () => {
  it("SQLSTATE 57014 を時間切れと判定する", () => {
    expect(isStatementTimeout({ code: "57014" })).toBe(true);
  });

  it("PostgreSQL のメッセージからも判定する(code が付かない経路がある)", () => {
    expect(isStatementTimeout(new Error("canceling statement due to statement timeout"))).toBe(true);
  });

  it("Prisma の P2024(プール取得の時間切れ)も時間切れとみなす", () => {
    expect(isStatementTimeout({ code: "P2024" })).toBe(true);
  });

  it("関係ないエラーは時間切れではない", () => {
    expect(isStatementTimeout(new Error("connection refused"))).toBe(false);
    expect(isStatementTimeout({ code: "P2002" })).toBe(false);
  });

  it("**再試行しない。** 同じクエリは同じだけ時間がかかる", () => {
    expect(isRetryablePrismaError({ code: "57014" })).toBe(false);
    expect(isRetryablePrismaError(new Error("canceling statement due to statement timeout"))).toBe(false);
  });

  it("デッドロックは従来どおり再試行する(時間切れと混同しない)", () => {
    expect(isRetryablePrismaError({ code: "P2034" })).toBe(true);
  });

  it("VALIDATION に分類する(DATABASE だと retryable になってしまう)", () => {
    const e = mapPrismaError({ code: "57014", message: "canceling statement due to statement timeout" });
    expect(e.code).toBe(ErrorCode.VALIDATION);
  });

  it("利用者に「絞り込んでください」と伝える(「データベースエラー」では手の打ちようがない)", () => {
    const e = mapPrismaError(new Error("canceling statement due to statement timeout"));
    expect(e.message).toContain("絞り込み");
  });
});
