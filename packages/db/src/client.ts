/**
 * PrismaClient の生成(Prisma 7 ドライバアダプタ方式)。
 *
 * Prisma 7 では PostgreSQL 用ドライバアダプタ `@prisma/adapter-pg` を使う。
 * 開発時のホットリロードで接続が増殖しないよう、グローバルにキャッシュする。
 *
 * @packageDocumentation
 */

import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma が生成したクライアントのクラス。
 *
 * **基盤は `@prisma/client` を import しない。** このリポジトリはアプリごとに
 * `schema.prisma` を分けており(ADR-0006)、生成先も `src/generated/prisma` に
 * 分けている。基盤が `@prisma/client` を読むと、**そこにあるのは
 * `packages/db` 自身の schema から生成されたもの**(モデルは AuditLog だけ)で、
 * アプリの 65 モデルは入っていない。
 */
export interface PrismaClientCtor<TClient> {
  new (options: { adapter: unknown; log?: unknown }): TClient;
}

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
   * const db = createDb(PrismaClient, url, {
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
 * **アプリが生成したクライアントのクラスを渡す。**
 * 型引数だけでは足りない。Prisma のクライアントは**生成時にモデルが焼き込まれる**ため、
 * 別の生成物を型だけ付け替えても、実体は元のモデルしか持たない。
 *
 * 2026-08 まではここで `@prisma/client` を new しており、型だけをアプリのものへ
 * キャストしていた。その結果 **`db.systemSetting` が undefined** になり、
 * 型検査もビルドも smoke も通るのに**画面を開くと落ちる**状態だった。
 * `as unknown as TClient` が型検査を黙らせていたのが原因。
 *
 * ここが引き受けるのは**接続の作法**だけ:
 * ドライバアダプタ(Prisma 7 方式)・開発時のホットリロードでの接続増殖防止・
 * クエリログの配線。**どのモデルを持つかはアプリの領分**。
 *
 * @param Client      アプリが生成した `PrismaClient` クラス(`../generated/prisma` から)
 * @param databaseUrl 接続文字列(通常は `@platform/env` 由来の検証済み値)
 * @param options     任意。`onQuery` を渡すと SQL を観測できる(開発時のデバッグ用)
 * @returns 共有クライアント
 *
 * @example
 * ```ts
 * // アプリ側(apps/internal-app/src/server/services.ts)
 * import { PrismaClient } from "../generated/prisma";
 *
 * export const db = createDb(PrismaClient, env.DATABASE_URL);
 * const rows = await db.expense.findMany();  // アプリのモデルが実体としてある
 * ```
 */
export function createDb<TClient>(
  Client: PrismaClientCtor<TClient>,
  databaseUrl: string,
  options: CreateDbOptions = {},
): TClient {
  const g = globalThis as unknown as { __prisma?: TClient };
  if (!g.__prisma) {
    const adapter = new PrismaPg({ connectionString: databaseUrl });
    // onQuery が渡されたときだけクエリログを有効にする(本番ではオーバーヘッドを避ける)
    g.__prisma = options.onQuery
      ? new Client({ adapter, log: [{ emit: "event", level: "query" }] })
      : new Client({ adapter });
    if (options.onQuery) {
      const onQuery = options.onQuery;
      // Prisma のイベント型は log 設定に依存するため、ここでは最小の形に絞って受ける
      (g.__prisma as { $on: (e: "query", cb: (ev: { query: string; duration: number; params?: string }) => void) => void })
        .$on("query", (ev) => {
          onQuery({ query: ev.query, durationMs: ev.duration, ...(ev.params ? { params: ev.params } : {}) });
        });
    }
  }
  return g.__prisma;
}
