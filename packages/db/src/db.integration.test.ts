import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "testcontainers";
import { createDb, executeRaw, queryRawValidated, sql } from "./index.js";
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";

/**
 * 実 PostgreSQL に対する統合テスト。
 * モックでは検証できない「SQL が本当に正しいか」を確認する。
 * 実行: `pnpm --filter @platform/db test:integration`(要 Docker)
 */
describe("db integration (real postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let db: PrismaClient;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:17-alpine").start();
    db = createDb(container.getConnectionUri());
    await executeRaw(db, sql`CREATE TABLE t (id int, label text)`);
    await executeRaw(db, sql`INSERT INTO t VALUES (1, 'a'), (2, 'b')`);
  });

  afterAll(async () => {
    await db.$disconnect();
    await container.stop();
  });

  it("生SQLの結果を型検証して取得できる", async () => {
    const row = z.object({ id: z.number(), label: z.string() });
    const res = await queryRawValidated(db, sql`SELECT id, label FROM t ORDER BY id`, row);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toEqual([
      { id: 1, label: "a" },
      { id: 2, label: "b" },
    ]);
  });
});
