import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { queryRaw, queryRawValidated, executeRaw, transaction, normalizeBigInt, sql } from "./index";
import { recordAudit } from "./index";
import type { PrismaClient } from "@prisma/client";

function mockDb(over: Partial<PrismaClient>): PrismaClient {
  return over as unknown as PrismaClient;
}

describe("db raw helpers", () => {
  it("queryRaw は成功時に行配列を ok で返す", async () => {
    const db = mockDb({ $queryRaw: vi.fn().mockResolvedValue([{ id: 1 }]) });
    const res = await queryRaw<{ id: number }>(db, sql`SELECT 1`);
    expect(res.ok && res.value).toEqual([{ id: 1 }]);
  });

  it("queryRaw は失敗時に DATABASE エラーを返す", async () => {
    const db = mockDb({ $queryRaw: vi.fn().mockRejectedValue(new Error("boom")) });
    const res = await queryRaw(db, sql`SELECT 1`);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("DATABASE");
  });

  it("queryRawValidated はスキーマ不一致で DATABASE エラーを返す", async () => {
    const db = mockDb({ $queryRaw: vi.fn().mockResolvedValue([{ id: "not-number" }]) });
    const res = await queryRawValidated(db, sql`SELECT 1`, z.object({ id: z.number() }));
    expect(res.ok).toBe(false);
  });

  it("executeRaw は影響行数を返す", async () => {
    const db = mockDb({ $executeRaw: vi.fn().mockResolvedValue(3) });
    const res = await executeRaw(db, sql`DELETE FROM t WHERE x = ${1}`);
    expect(res.ok && res.value).toBe(3);
  });

  it("transaction は成功時に結果を返す", async () => {
    const db = mockDb({ $transaction: vi.fn().mockImplementation((fn: any) => fn({})) });
    const res = await transaction(db, async () => "done");
    expect(res.ok && res.value).toBe("done");
  });
});

describe("normalizeBigInt", () => {
  it("BigInt を JSON 安全な数値に変換する", () => {
    expect(normalizeBigInt({ total: 5n })).toEqual({ total: 5 });
  });
});

describe("recordAudit", () => {
  it("AuditLog.create を呼ぶ", async () => {
    const create = vi.fn().mockResolvedValue({});
    const db = mockDb({ auditLog: { create } } as unknown as Partial<PrismaClient>);
    const res = await recordAudit(db, { actor: "u1", action: "test" });
    expect(res.ok).toBe(true);
    expect(create).toHaveBeenCalled();
  });
});
