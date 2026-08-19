/**
 * 通知の重複抑制。同一イベントの再送(リトライ・競合)で二重通知しないよう、
 * キー単位で TTL 内の再送をスキップする。
 * @packageDocumentation
 */
import type { NotifyChannel, NotifyMessage } from "./index";

/** 既送信キーの記録ストア。 */
export interface SeenStore {
  /** key を記録し、既に記録済みなら true(=重複)を返す。 */
  markSeen(key: string, ttlMs: number): boolean;
  /** 記録せずに既存かどうかだけ確認する(peek)。 */
  has(key: string): boolean;
}

/**
 * 重複抑制ストアのメモリ実装(TTL 付き)。
 *
 * **複数プロセスでは効かない**(プロセスごとに別のメモリを持つため、
 * サーバの数だけ通知が飛ぶ)。**本番では Redis 実装に差し替えること**。
 *
 * @param now 現在時刻(**テスト注入用**。渡さなければ `new Date()`)
 * @returns ストア
 */
export function createMemorySeenStore(now: () => number = () => Date.now()): SeenStore {
  const seen = new Map<string, number>(); // key -> expiresAt
  return {
    markSeen(key, ttlMs) {
      const t = now();
      // 期限切れの掃除
      for (const [k, exp] of seen) if (exp <= t) seen.delete(k);
      const exp = seen.get(key);
      if (exp !== undefined && exp > t) return true; // 重複
      seen.set(key, t + ttlMs);
      return false;
    },
    has(key) {
      const exp = seen.get(key);
      return exp !== undefined && exp > now();
    },
  };
}

/** dedup 設定。 */
export interface DedupOptions {
  store: SeenStore;
  /** メッセージからキーを作る(既定: level+text)。 */
  keyOf?: (message: NotifyMessage) => string;
  /** 抑制する時間窓(ms)。 */
  ttlMs: number;
  /** 重複でスキップした時のコールバック。 */
  onSkip?: (key: string) => void;
}

/**
 * 通知を重複抑制でラップする。
 *
 * **同じ通知を何度も送らない**(リトライやイベントの重複で、
 * 利用者に同じ通知が 5 回届くと信頼を失う)。
 *
 * @param channel 元のチャネル
 * @param options `store`(既送信の記録先)と `ttlMs`(抑制する時間窓)は必須。
 *   `keyOf`(既定は level+text)と `onSkip`(抑制時の通知)は任意
 * @returns ラップしたチャネル
 */
export function withDedup(channel: NotifyChannel, options: DedupOptions): NotifyChannel {
  const keyOf = options.keyOf ?? ((m: NotifyMessage) => `${m.level ?? "info"}:${m.text}`);
  return {
    async send(message) {
      const key = keyOf(message);
      if (options.store.markSeen(key, options.ttlMs)) {
        options.onSkip?.(key);
        return; // 重複 → 送信しない
      }
      await channel.send(message);
    },
  };
}
