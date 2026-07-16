/**
 * ストレージのリトライと多段フォールバック。一時障害を吸収し、主保存先の障害時は
 * 副保存先へ切り替える。すべて StorageAdapter を返すので createStorage に渡せて合成可能。
 * @packageDocumentation
 */
import { defaultShouldRetry } from "@platform/core";
import type { StorageAdapter, PutOptions, PresignOptions } from "./index.js";

/** リトライ設定。 */
export interface StorageRetryOptions {
  /** 最大リトライ回数(既定 2)。 */
  retries?: number;
  /** n 回目失敗後の待機 ms(既定: 指数 100,200,400...)。 */
  backoffMs?: (attempt: number) => number;
  /** リトライすべきエラーか(既定: 常に true)。 */
  shouldRetry?: (error: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
}

async function retry<T>(fn: () => Promise<T>, o: Required<Pick<StorageRetryOptions, "retries" | "backoffMs" | "shouldRetry" | "sleep">>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= o.retries; attempt++) {
    try { return await fn(); }
    catch (e) { lastError = e; if (attempt < o.retries && o.shouldRetry(e)) { await o.sleep(o.backoffMs(attempt + 1)); continue; } break; }
  }
  throw lastError;
}

/**
 * Adapter をリトライでラップする(put/get/delete/exists/list に適用)。
 *
 *
 * @param storage 元のストレージ
 * @param options.attempts 最大試行回数
 * @returns ラップしたストレージ(**恒久エラーは再試行しない**)
 */
export function withStorageRetry(adapter: StorageAdapter, options: StorageRetryOptions = {}): StorageAdapter {
  const o = {
    retries: options.retries ?? 2,
    backoffMs: options.backoffMs ?? ((n: number) => 100 * 2 ** (n - 1)),
    shouldRetry: options.shouldRetry ?? defaultShouldRetry,
    sleep: options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms))),
  };
  return {
    put: (key, body, opts) => retry(() => adapter.put(key, body, opts), o),
    get: (key) => retry(() => adapter.get(key), o),
    delete: (key) => retry(() => adapter.delete(key), o),
    exists: (key) => retry(() => adapter.exists(key), o),
    list: (prefix) => retry(() => adapter.list(prefix), o),
    ...(adapter.presignPut ? { presignPut: (key: string, opts?: PresignOptions) => adapter.presignPut!(key, opts) } : {}),
    ...(adapter.presignGet ? { presignGet: (key: string, opts?: PresignOptions) => adapter.presignGet!(key, opts) } : {}),
  };
}

/** フォールバック設定。 */
export interface FallbackStorageOptions {
  /** 書き込みを全保存先へミラーする(冗長化・既定 false=主のみ、失敗時に副へ)。 */
  mirrorWrites?: boolean;
  /** 保存先切替が起きた時のコールバック(監視用)。 */
  onFallback?: (op: string, failedIndex: number, error: unknown) => void;
}

/**
 * 複数保存先を束ねる。読み取り(get/exists/list)は主→副の順に試し最初の成功で確定。
 * 書き込み(put/delete)は既定で主のみ、失敗時に副へ。mirrorWrites で全先へ複製。
 *
 * @example
 * ```ts
 * const adapter = createFallbackStorage([s3, localDisk], { mirrorWrites: true });
 * const storage = createStorage(adapter); // S3 障害時はローカルで継続
 * ```
 *
 * @param storages ストレージの配列(優先順)
 * @returns ラップしたストレージ
 * @throws 全部失敗した場合
 */
export function createFallbackStorage(adapters: StorageAdapter[], options: FallbackStorageOptions = {}): StorageAdapter {
  if (adapters.length === 0) throw new Error("フォールバックには 1 つ以上の保存先が必要です");

  async function readThrough<T>(op: string, fn: (a: StorageAdapter) => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let i = 0; i < adapters.length; i++) {
      try { return await fn(adapters[i]!); }
      catch (e) { lastError = e; options.onFallback?.(op, i, e); }
    }
    throw lastError;
  }

  async function writeAll(op: string, fn: (a: StorageAdapter) => Promise<void>): Promise<void> {
    if (options.mirrorWrites) {
      // 全先へ書き込み。主が成功すれば全体成功、副の失敗は onFallback で通知(best-effort)。
      const results = await Promise.allSettled(adapters.map((a) => fn(a)));
      const primary = results[0];
      results.forEach((r, i) => { if (r.status === "rejected") options.onFallback?.(op, i, r.reason); });
      if (primary && primary.status === "rejected") {
        // 主が失敗でも、いずれか成功していれば継続可
        if (!results.some((r) => r.status === "fulfilled")) throw primary.reason;
      }
      return;
    }
    // 主のみ → 失敗時に副へフォールバック
    await readThrough(op, fn);
  }

  return {
    put: (key, body, opts?: PutOptions) => writeAll("put", (a) => a.put(key, body, opts)),
    delete: (key) => writeAll("delete", (a) => a.delete(key)),
    get: (key) => readThrough("get", (a) => a.get(key)),
    exists: (key) => readThrough("exists", (a) => a.exists(key)),
    list: (prefix) => readThrough("list", (a) => a.list(prefix)),
    // 署名 URL は主保存先のものを使う(対応していれば)
    ...(adapters[0]!.presignPut ? { presignPut: (key: string, opts?: PresignOptions) => adapters[0]!.presignPut!(key, opts) } : {}),
    ...(adapters[0]!.presignGet ? { presignGet: (key: string, opts?: PresignOptions) => adapters[0]!.presignGet!(key, opts) } : {}),
  };
}
