/**
 * 相関コンテキスト。AsyncLocalStorage で traceId/requestId 等をリクエスト内に伝播し、
 * 明示的に引き回さずに全ログへ自動付与できるようにする。
 * @packageDocumentation
 */
import { AsyncLocalStorage } from "node:async_hooks";

/** ログに載せる相関フィールド。 */
export type LogContext = Record<string, unknown>;

/** コンテキストストア。 */
export interface ContextStore {
  /** ctx を束ねて fn を実行する(非同期の連鎖でも保持される)。 */
  run<T>(ctx: LogContext, fn: () => T): T;
  /** 現在のコンテキスト(無ければ空)。 */
  get(): LogContext;
  /** 現在のコンテキストに 1 フィールド追加する。 */
  set(key: string, value: unknown): void;
  /** logger の contextProvider に渡せる関数。 */
  provider(): LogContext;
}

/** コンテキストストアを作る。
 * @returns 相関コンテキストのストア(`run` で境界を張り、`get` で取り出す)
 */
export function createContextStore(): ContextStore {
  const als = new AsyncLocalStorage<LogContext>();
  return {
    run(ctx, fn) { return als.run({ ...ctx }, fn); },
    get() { return als.getStore() ?? {}; },
    set(key, value) { const s = als.getStore(); if (s) s[key] = value; },
    provider() { return als.getStore() ?? {}; },
  };
}
