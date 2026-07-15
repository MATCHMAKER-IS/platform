/**
 * レート制限のストア抽象と結果型。
 * @packageDocumentation
 */

/** 固定ウィンドウのカウンタを扱うストア。 */
export interface RateLimitStore {
  /**
   * キーのカウンタを 1 増やし、ウィンドウ内の現在値を返す。
   * 新規キーには windowSeconds の有効期限を設定する。
   */
  increment(key: string, windowSeconds: number): Promise<number>;
}

/** 判定結果。 */
export interface RateLimitResult {
  /** 許可されたか。 */
  allowed: boolean;
  /** 残り許容回数。 */
  remaining: number;
  /** ウィンドウ内の現在カウント。 */
  current: number;
  /** 上限。 */
  limit: number;
}
