/**
 * 冪等性(Idempotency-Key)。同一キーの操作を二重実行させず、初回結果を再利用する。
 * 外部連携(Zoho/決済)の再送やリトライで効く。ストアは差し替え可能(既定はメモリ+TTL)。
 *
 * 中核は `reserve`(SETNX 相当のアトミックな予約)。get→set の隙間による競合を避ける。
 * @packageDocumentation
 */

/** 保存されるレコード。 */
export interface IdempotencyRecord<T = unknown> { status: "in_progress" | "completed"; result?: T; createdAt: number }

/** 冪等ストア(Redis 等に差し替え可能)。 */
export interface IdempotencyStore {
  /** アトミックに予約する。未登録なら record を保存して null を返す。既にあれば既存レコードを返す(=予約失敗)。 */
  reserve(key: string, record: IdempotencyRecord): Promise<IdempotencyRecord | null> | IdempotencyRecord | null;
  /** 完了レコードで上書きする。 */
  complete(key: string, record: IdempotencyRecord): Promise<void> | void;
  /** 参照。 */
  get(key: string): Promise<IdempotencyRecord | null> | IdempotencyRecord | null;
  /** 削除(失敗時のキー解放)。 */
  delete(key: string): Promise<void> | void;
}

/**
 * 冪等ストアのメモリ実装(TTL 付き・単一プロセス内でアトミック)。
 *
 * **複数プロセスでは使えない**(プロセスごとに別のメモリを持つため、
 * 重複を検出できない)。本番では Redis 実装を使うこと。
 *
 * @param options.ttlMs 保持する時間(既定 24 時間)
 * @param options.now 時刻の取得(テスト注入用)
 * @returns 冪等ストア
 */
export function createMemoryIdempotencyStore(ttlMs = 24 * 60 * 60 * 1000, now: () => number = () => Date.now()): IdempotencyStore {
  const map = new Map<string, IdempotencyRecord>();
  const prune = () => { const t = now(); for (const [k, v] of map) if (t - v.createdAt > ttlMs) map.delete(k); };
  return {
    reserve(key, record) {
      prune();
      const existing = map.get(key);
      if (existing) return existing; // 予約失敗(既存を返す)
      map.set(key, record); // 同期・アトミック
      return null;
    },
    complete(key, record) { map.set(key, record); },
    get(key) { prune(); return map.get(key) ?? null; },
    delete(key) { map.delete(key); },
  };
}

/** 二重実行時のエラー。 */
export class IdempotencyConflictError extends Error {
  readonly key: string;
  constructor(key: string) { super(`処理が進行中です(idempotency key: ${key})`); this.key = key; }
}

/**
 * キー付きで処理を1回だけ実行する。
 *  - 未実行 → fn を実行し結果を保存して返す。
 *  - 完了済み → 保存済み結果を返す(fn は実行しない)。
 *  - 進行中 → IdempotencyConflictError(同時多重を防ぐ)。
 *
 * @param store 冪等ストア
 * @param key 冪等キー(**同じ処理には同じキー**。リクエスト ID など)
 * @param fn 実行する処理
 * @param options.ttlMs 記録の保持期間
 * @returns 処理の結果と、**新規実行か再利用か**(`replayed`)
 * @throws {@link @platform/core#AppError} コード `CONFLICT` — 同じキーの処理が実行中の場合
 *   (二重実行を防ぐため、待たずに失敗させる)
 */
export async function withIdempotency<T>(store: IdempotencyStore, key: string, fn: () => Promise<T>, now: () => number = () => Date.now()): Promise<T> {
  const existing = await store.reserve(key, { status: "in_progress", createdAt: now() });
  if (existing) {
    if (existing.status === "completed") return existing.result as T;
    throw new IdempotencyConflictError(key);
  }
  try {
    const result = await fn();
    await store.complete(key, { status: "completed", result, createdAt: now() });
    return result;
  } catch (e) {
    await store.delete(key); // 失敗時はキーを解放して再試行を許す
    throw e;
  }
}
