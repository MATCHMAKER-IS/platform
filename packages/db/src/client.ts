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
 * `createDb` がクライアントを組み立てるときに渡す設定。
 *
 * **基盤は `@prisma/client` を import しない。** このリポジトリはアプリごとに
 * `schema.prisma` を分けており(ADR-0006)、生成先も `src/generated/prisma` に
 * 分けている。基盤が `@prisma/client` を読むと、**そこにあるのは
 * `packages/db` 自身の schema から生成されたもの**(モデルは AuditLog だけ)で、
 * アプリの 65 モデルは入っていない。
 *
 * **`new` するのはアプリ側**(下の {@link createDb} の第 1 引数)。
 * 基盤がクラスを受け取って `new` すると、**Prisma がモデルの型を決められない**
 * ——生成された `PrismaClient` は**渡した設定オブジェクトの形から**型引数を決めるので、
 * 基盤の抽象化された型を通すと `findUnique` の戻り値が `{}` になる
 * (2026-08、`row.value does not exist on type '{}'` として現れた)。
 */
export interface DbClientOptions {
  /** ドライバアダプタ(接続プール・タイムアウトはここで決めてある)。 */
  adapter: PrismaPg;
  /** クエリログ。`onQuery` を渡したときだけ入る。 */
  log?: { emit: "event"; level: "query" }[];
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
   * 接続プールの上限(既定 10)。
   *
   * **DB 側の上限を先に使い切らないため。**
   * PostgreSQL の既定は 100 で、そこを埋めると
   * 他のアプリや管理ツールも繋げなくなる。
   *
   * 1 インスタンスあたりの値。3 台構成なら合計 30 になる。
   */
  poolMax?: number;
  /**
   * 1 本のクエリが実行できる上限時間(ミリ秒)。既定 **30 秒**。
   *
   * **これが無いと、遅いクエリが接続を占有し続ける。**
   * 索引の無い全件走査や、うっかりのクロス結合は**何分でも走り続ける**。
   * その間その接続は返らないので、`poolMax`(既定 10)が埋まると
   * **アプリ全体が「DB に繋がらない」状態**になる——
   * 原因のクエリは 1 本なのに、**画面はすべて落ちる**。
   *
   * PostgreSQL 側で打ち切れば、そのクエリだけが `57014` で失敗し、
   * 接続はプールへ返る。**被害を 1 リクエストに閉じ込める**ための設定である。
   *
   * **長い処理には別の接続を使うこと。** 夜間バッチや CSV 出力で
   * 30 秒を超えるものは、`statementTimeoutMs` を長くした
   * **別のクライアント**を作る——ここを伸ばすと、画面からの事故も伸びる。
   *
   * `0` を渡すと無制限(PostgreSQL の既定)。**本番では使わないこと**。
   */
  statementTimeoutMs?: number;
  /**
   * SQL が実行されるたびに呼ばれる。**開発時のデバッグ用**。
   * 渡すと Prisma のクエリログが有効になる(わずかにオーバーヘッドがあるため本番では渡さない)。
   *
   * @example
   * ```ts
   * const db = createDb((o) => new PrismaClient(o), url, {
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
 * **`new` はアプリ側でする。** 第 1 引数は「設定を受け取って `PrismaClient` を作る関数」。
 *
 * 2026-08 まではクラスそのものを受け取って基盤が `new` していたが、
 * **Prisma のモデルの型は「`new` に渡した設定オブジェクトの形」から決まる**ため、
 * 基盤の抽象化された型を経由すると `findUnique` の戻り値が `{}` になり、
 * `row.value` が「存在しない」と言われる。**アプリの中で `new` すれば、
 * 普通の Prisma アプリと同じ型が付く。**
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
 * @param createClient アプリが `PrismaClient` を `new` する関数(`(o) => new PrismaClient(o)`)
 * @param databaseUrl 接続文字列(通常は `@platform/env` 由来の検証済み値)
 * @param options     任意。`onQuery` を渡すと SQL を観測できる(開発時のデバッグ用)
 * @returns 共有クライアント
 *
 * @example
 * ```ts
 * // アプリ側(apps/internal-app/src/server/services.ts)
 * import { PrismaClient } from "../generated/prisma";
 *
 * export const db = createDb((o) => new PrismaClient(o), env.DATABASE_URL);
 * const rows = await db.expense.findMany();  // アプリのモデルが実体としてある
 * ```
 */
export function createDb<TClient>(
  createClient: (options: DbClientOptions) => TClient,
  databaseUrl: string,
  options: CreateDbOptions = {},
): TClient {
  const g = globalThis as unknown as { __prisma?: TClient };
  if (!g.__prisma) {
    // **接続の上限を決める。**
    // 既定のままだと、要求が増えたぶんだけ接続を開き、
    // **DB 側の上限(PostgreSQL は既定 100)を先に使い切る**。
    // そうなると、他のアプリや管理ツールも繋げなくなる。
    //
    // 1 インスタンスあたり 10。3 台構成なら 30 で、管理用の余裕を残せる。
    //
    // **環境変数を直読みしない。** 基盤が環境を知ると、
    // 呼ぶ側から挙動が見えなくなる(`options` で渡してもらう)。
    // 既定 30 秒。**画面からの操作でこれを超えるものは設計が疑わしい**
    // (利用者はその前に諦めるか、再読み込みして二重に走らせる)。
    const statementTimeoutMs = options.statementTimeoutMs ?? 30_000;
    const adapter = new PrismaPg({
      connectionString: databaseUrl,
      max: options.poolMax ?? 10,
      // **空いた接続は返す。** 抱えたままだと、
      // 夜間に使わなくても上限を占有し続ける
      idleTimeoutMillis: 30_000,
      // **繋がらないときは待たせない。**
      // 既定は無制限で、DB が落ちていると要求が溜まり続ける
      connectionTimeoutMillis: 5_000,
      // **1 本のクエリが接続を占有し続けないようにする。**
      // `options` に `statement_timeout` を入れると、この接続で実行される
      // すべてのクエリに効く(セッション単位の設定)。
      // 打ち切られたクエリは `57014 query_canceled` で失敗し、
      // **接続はプールへ返る**——ここが肝で、返らないと他の要求が待たされる。
      ...(statementTimeoutMs > 0
        ? { options: `-c statement_timeout=${statementTimeoutMs}` }
        : {}),
    });
    // onQuery が渡されたときだけクエリログを有効にする(本番ではオーバーヘッドを避ける)
    g.__prisma = createClient(
      options.onQuery ? { adapter, log: [{ emit: "event", level: "query" }] } : { adapter },
    );
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
