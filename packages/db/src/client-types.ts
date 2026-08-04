/**
 * **生成物に依存しない Prisma クライアントの型。**
 *
 * 【なぜ必要か】
 * `@prisma/client` の `PrismaClient` は **`prisma generate` の結果**であり、
 * どの `schema.prisma` で生成したかによって中身が変わる。
 * このリポジトリはアプリごとに schema を分けている(ADR-0006)ので、
 * 基盤が `@prisma/client` の型を直接使うと、
 * **「最後に generate したアプリ」の型しか通らない**ことになる。
 *
 * 実際に 2026-07、`internal-app` の 20 箇所が
 * `Property 'expense' does not exist on type 'PrismaClient'` で落ちた。
 * `packages/db` の schema(AuditLog のみ)で生成されていたためである。
 *
 * 【解決】
 * 基盤は**実際に使うメソッドだけ**を構造的な型として要求する。
 * こうすればアプリが自前で生成したクライアント(`output` で分けたもの)も、
 * `@prisma/client` のものも、同じように渡せる。
 *
 * 型を広く取りすぎない(= `PrismaClient` 全体を要求しない)ことが要点。
 * @packageDocumentation
 */

/**
 * `$transaction` に渡されるトランザクション用クライアント。
 *
 * **モデルへのアクセスは呼び出し側が型を付ける。** ここで索引シグネチャを持たせると、
 * Prisma が生成した型を渡すときに代入互換が崩れる(索引シグネチャは相手にも要求される)。
 */
export interface TransactionClient {
  $queryRaw<T = unknown>(query: unknown, ...values: unknown[]): Promise<T>;
  $executeRaw(query: unknown, ...values: unknown[]): Promise<number>;
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}

/**
 * 生 SQL を実行できるクライアント。
 *
 * `queryRaw` / `executeRaw` / `transaction` はこれだけを要求する。
 * `$transaction` の第 2 引数(分離レベルなど)は任意。
 */
export interface RawCapableClient {
  $queryRaw<T = unknown>(query: unknown, ...values: unknown[]): Promise<T>;
  $executeRaw(query: unknown, ...values: unknown[]): Promise<number>;
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  $transaction<R>(fn: (tx: TransactionClient) => Promise<R>, options?: unknown): Promise<R>;
}

/** 1 つのモデルに対する最小の操作(監査ログなど、基盤が直接触るもの)。 */
export interface ModelDelegate {
  create(args: { data: Record<string, unknown> }): Promise<unknown>;
  findMany(args?: Record<string, unknown>): Promise<unknown[]>;
  count(args?: Record<string, unknown>): Promise<number>;
}

/**
 * 監査ログを書けるクライアント。
 *
 * **`auditLog` モデルを持つ schema でのみ使える。** 持たない schema の
 * クライアントを渡すと型で弾かれる(実行時に落ちるより早く気づける)。
 */
export interface AuditCapableClient {
  auditLog: ModelDelegate;
}

/**
 * トランザクション内でモデルを取り出す。
 *
 * `TransactionClient` は索引シグネチャを持たない(持たせると Prisma の生成型と
 * 代入互換が崩れる)ため、モデルへは**このヘルパー経由**で触る。
 * 型引数に期待する形を書くと、その形として扱える。
 *
 * @param tx トランザクションクライアント
 * @param name モデル名(`"expense"` など。**生成物のプロパティ名**)
 * @returns そのモデルのデリゲート
 *
 * @example
 * ```ts
 * await bulkInsert(db, (tx) => model<CreateDelegate<Product>>(tx, "product"), rows);
 * ```
 */
export function model<T>(tx: TransactionClient, name: string): T {
  return (tx as unknown as Record<string, T>)[name] as T;
}

/**
 * そのクライアントの**トランザクション用の型**を取り出す。
 *
 * Prisma が生成した `PrismaClient` は `$transaction` の引数として
 * **そのアプリのモデルを持つトランザクションクライアント**を受け取る。
 * ここからその型を取り出せば、`withTransaction` の中で `tx.expense` のように
 * **モデルへ型付きで触れる**。
 *
 * 取り出せない場合(基盤の {@link RawCapableClient} など)は
 * {@link TransactionClient} にフォールバックする。
 *
 * @example
 * ```ts
 * // db は createDb<PrismaClient>() で作ったアプリ固有の型
 * await withTransaction(db, async (tx) => {
 *   await tx.expense.createMany({ data });  // 型が付く
 * });
 * ```
 */
export type TransactionClientOf<TClient> =
  TClient extends { $transaction<R>(fn: (tx: infer TTx) => Promise<R>, ...rest: never[]): unknown }
    ? TTx
    : TransactionClient;

/**
 * Json 列に入れる値を、Prisma の入力型として受け入れられる形にする。
 *
 * 【なぜ必要か】
 * Prisma の `InputJsonValue` はオブジェクトに**索引シグネチャ**を要求する。
 * `interface Theme { ... }` のように名前の付いた型や、その配列は
 * 索引シグネチャを持たないため、Json 列にそのまま渡すと型エラーになる。
 *
 *     value: { entries: history }   // ❌ Type 'ThemeHistoryEntry[]' is not assignable
 *     value: toJson({ entries: history })  // ✅
 *
 * **中身は変えない**(実行時は何もしない)。JSON として妥当な値を渡すのは呼び出し側の責任。
 * 関数や `undefined` を含む値を渡すと、保存時に落ちるか黙って欠ける。
 *
 * @param value Json 列に入れる値(**JSON として妥当なもの**)
 * @returns Prisma の入力型として渡せる値
 */
export function toJson(value: unknown): never {
  return value as never;
}
