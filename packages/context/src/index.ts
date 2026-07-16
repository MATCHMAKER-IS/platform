/**
 * `@platform/context` — リクエストスコープのコンテキスト(相関ID)。
 *
 * `AsyncLocalStorage` を使い、1 リクエストの処理中ずっと `requestId` や
 * `userId` を持ち回る。これにより「どのログがどのリクエストか」を後から追える。
 * デバッグ・障害調査の効率が大きく変わる、地味だが効く基盤。
 *
 * @packageDocumentation
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

/** リクエストごとに持ち回る値。 */
export interface RequestContext {
  /** リクエストを一意に識別する相関ID。 */
  requestId: string;
  /** 認証済みユーザー ID(あれば)。 */
  userId?: string;
  /** 任意の追加フィールド。 */
  [key: string]: unknown;
}

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * コンテキストを張ってコールバックを実行する。この中の処理は `getContext()` で
 * 同じコンテキストを参照できる。通常はリクエスト境界(ミドルウェア等)で呼ぶ。
 *
 * @param context 初期コンテキスト(requestId 未指定なら自動採番)
 * @param fn      実行する処理
 * @returns fn の戻り値
 *
 * @example
 * ```ts
 * await runWithContext({ userId: session.user.id }, async () => {
 *   log.info({}, "処理開始"); // ログに requestId/userId が自動で乗る(bindLogger 経由)
 * });
 * ```
 */
export function runWithContext<T>(
  context: Partial<RequestContext>,
  fn: () => T,
): T {
  const ctx: RequestContext = { requestId: context.requestId ?? randomUUID(), ...context };
  return storage.run(ctx, fn);
}

/**
 * 現在のコンテキストを取得する(境界の外では undefined)。
 *
 * @returns 現在のコンテキスト。**コンテキスト外なら undefined**(バッチや起動時の処理では無い)
 */
export function getContext(): RequestContext | undefined {
  return storage.getStore();
}

/**
 * 現在の相関ID(コンテキスト外では undefined)。
 *
 * @returns リクエスト ID。**無ければ undefined**(ログに出すときは `unknown` などにフォールバックする)
 */
export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

/**
 * 現在のコンテキストに値を追記する(例: 認証後に userId を足す)。
 *
 * @param key キー
 * @param value 値(**リクエストの間だけ有効**。非同期処理をまたいでも保たれる)
 */
export function setContextValue(key: string, value: unknown): void {
  const ctx = storage.getStore();
  if (ctx) ctx[key] = value;
}

/** `child()` を持つ最小ロガー型(logger への依存を避けるための構造的型)。 */
export interface Childable<T> {
  child(bindings: Record<string, unknown>): T;
}

/**
 * ロガーを現在のコンテキストで束ねて返す。以降のログに requestId 等が自動で乗る。
 * `@platform/logger` に依存せず、`child()` を持つ任意のロガーに使える。
 *
 * @param logger `child()` を持つロガー
 * @returns コンテキストを束ねたロガー(コンテキスト外なら元のまま)
 *
 * @example
 * ```ts
 * const reqLog = bindLogger(log); // requestId/userId 付き
 * reqLog.info({}, "ユーザー取得");
 * ```
 */
export function bindLogger<T>(logger: Childable<T>): T {
  const ctx = getContext();
  return ctx ? logger.child({ ...ctx }) : (logger as unknown as T);
}
