import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { queryRaw, queryRawValidated, executeRaw, transaction, normalizeBigInt, sql, raw } from "./index";
import { recordAudit } from "./index";
import type { PrismaClient } from "@prisma/client";

function mockDb(over: Partial<PrismaClient>): PrismaClient {
  return over as unknown as PrismaClient;
}

// **`$queryRawUnsafe` / `$executeRawUnsafe` を見る。**
// 2026-08 に `Prisma.sql`(= `prisma generate` の生成物)への依存を切り、
// `sql` タグは `$1, $2 …` に展開してパラメータを**別引数で**渡す形にした。
// 名前に `Unsafe` と付くが、**値は文字列に連結されずドライバが束縛する**
// ——安全性は `$queryRaw` と同じ(詳細は `sql-tag.ts` の冒頭)。
describe("db raw helpers", () => {
  it("queryRaw は成功時に行配列を ok で返す", async () => {
    const db = mockDb({ $queryRawUnsafe: vi.fn().mockResolvedValue([{ id: 1 }]) });
    const res = await queryRaw<{ id: number }>(db, sql`SELECT 1`);
    expect(res.ok && res.value).toEqual([{ id: 1 }]);
  });

  it("queryRaw は失敗時に DATABASE エラーを返す", async () => {
    const db = mockDb({ $queryRawUnsafe: vi.fn().mockRejectedValue(new Error("boom")) });
    const res = await queryRaw(db, sql`SELECT 1`);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("DATABASE");
  });

  it("queryRawValidated はスキーマ不一致で DATABASE エラーを返す", async () => {
    const db = mockDb({ $queryRawUnsafe: vi.fn().mockResolvedValue([{ id: "not-number" }]) });
    const res = await queryRawValidated(db, sql`SELECT 1`, z.object({ id: z.number() }));
    expect(res.ok).toBe(false);
  });

  it("executeRaw は影響行数を返す", async () => {
    const db = mockDb({ $executeRawUnsafe: vi.fn().mockResolvedValue(3) });
    const res = await executeRaw(db, sql`DELETE FROM t WHERE x = ${1}`);
    expect(res.ok && res.value).toBe(3);
  });

  it("transaction は成功時に結果を返す", async () => {
    const db = mockDb({ $transaction: vi.fn().mockImplementation((fn: any) => fn({})) });
    const res = await transaction(db, async () => "done");
    expect(res.ok && res.value).toBe("done");
  });
});

// **ここが安全性の要。** 値が SQL 文字列に混ざらないことを固定する。
// 壊れると SQL インジェクションを許すので、消さないこと。
describe("sql タグは値をプレースホルダにする", () => {
  it("差し込んだ値は $1, $2 … になり、別引数で渡る", async () => {
    const spy = vi.fn().mockResolvedValue([]);
    const db = mockDb({ $queryRawUnsafe: spy });
    await queryRaw(db, sql`SELECT * FROM t WHERE a = ${1} AND b = ${"x"}`);
    expect(spy).toHaveBeenCalledWith("SELECT * FROM t WHERE a = $1 AND b = $2", 1, "x");
  });

  it("危険な文字列を渡しても SQL 文には出ない", async () => {
    const spy = vi.fn().mockResolvedValue([]);
    const db = mockDb({ $queryRawUnsafe: spy });
    await queryRaw(db, sql`SELECT * FROM t WHERE name = ${"'; DROP TABLE t; --"}`);
    const [text, ...values] = spy.mock.calls[0] as [string, ...unknown[]];
    expect(text).not.toContain("DROP");
    expect(values).toEqual(["'; DROP TABLE t; --"]);
  });

  it("入れ子にしても番号がずれない", async () => {
    const spy = vi.fn().mockResolvedValue([]);
    const db = mockDb({ $queryRawUnsafe: spy });
    const cond = sql`b = ${2}`;
    await queryRaw(db, sql`SELECT * FROM t WHERE a = ${1} AND ${cond} AND c = ${3}`);
    expect(spy).toHaveBeenCalledWith("SELECT * FROM t WHERE a = $1 AND b = $2 AND c = $3", 1, 2, 3);
  });

  it("raw() はそのまま埋め込む(識別子用。検証は呼び出し側の責任)", async () => {
    const spy = vi.fn().mockResolvedValue([]);
    const db = mockDb({ $queryRawUnsafe: spy });
    await queryRaw(db, sql`SELECT * FROM ${raw('"users"')} WHERE id = ${7}`);
    expect(spy).toHaveBeenCalledWith('SELECT * FROM "users" WHERE id = $1', 7);
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
