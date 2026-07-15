/**
 * PrismaClient の生成(Prisma 7 ドライバアダプタ方式)。
 *
 * Prisma 7 では PostgreSQL 用ドライバアダプタ `@prisma/adapter-pg` を使う。
 * 開発時のホットリロードで接続が増殖しないよう、グローバルにキャッシュする。
 *
 * @packageDocumentation
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/** 実行された SQL の情報(onQuery で受け取る)。 */
export interface QueryInfo {
  /** SQL 文。 */
  query: string;
  /** 所要時間(ms)。 */
  durationMs: number;
  /** パラメータ(JSON 文字列)。 */
  params?: string;
}

/** {@link createDb} のオプション。 */
export interface CreateDbOptions {
  /**
   * SQL が実行されるたびに呼ばれる。**開発時のデバッグ用**。
   * 渡すと Prisma のクエリログが有効になる(わずかにオーバーヘッドがあるため本番では渡さない)。
   *
   * @example
   * ```ts
   * const db = createDb(url, {
   *   onQuery: (q) => debugCollector.record(getRequestId(), {
   *     kind: "sql", label: summarizeSql(q.query), durationMs: q.durationMs, ok: true,
   *   }),
   * });
   * ```
   */
  onQuery?: (info: QueryInfo) => void;
}

/**
 * PrismaClient のシングルトンを生成する。
 *
 * @param databaseUrl 接続文字列(通常は `@platform/env` 由来の検証済み値)
 * @param options     任意。`onQuery` を渡すと SQL を観測できる(開発時のデバッグ用)
 * @returns 共有 {@link PrismaClient}
 *
 * @example
 * ```ts
 * const db = createDb(env.DATABASE_URL);
 * const users = await db.user.findMany();
 * ```
 */
export function createDb(databaseUrl: string, options: CreateDbOptions = {}): PrismaClient {
  const g = globalThis as unknown as { __prisma?: PrismaClient };
  if (!g.__prisma) {
    const adapter = new PrismaPg({ connectionString: databaseUrl });
    // onQuery が渡されたときだけクエリログを有効にする(本番ではオーバーヘッドを避ける)
    g.__prisma = options.onQuery
      ? new PrismaClient({ adapter, log: [{ emit: "event", level: "query" }] })
      : new PrismaClient({ adapter });
    if (options.onQuery) {
      const onQuery = options.onQuery;
      // Prisma のイベント型は log 設定に依存するため、ここでは最小の形に絞って受ける
      (g.__prisma as unknown as { $on: (e: "query", cb: (ev: { query: string; duration: number; params?: string }) => void) => void })
        .$on("query", (ev) => {
          onQuery({ query: ev.query, durationMs: ev.duration, ...(ev.params ? { params: ev.params } : {}) });
        });
    }
  }
  return g.__prisma;
}
