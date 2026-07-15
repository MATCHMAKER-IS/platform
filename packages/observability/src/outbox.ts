/**
 * トランザクショナル Outbox。業務データと同一トランザクションでメッセージを保存し、
 * 別プロセス(リレー)が確実に一度だけ送信する。DB コミットと外部送信の不整合を防ぐ。
 * ここではストア抽象と中継ロジック(純)を提供。実ストアはアプリが DB で実装する。
 * @packageDocumentation
 */

/** Outbox メッセージ。 */
export interface OutboxMessage<T = unknown> {
  id: string;
  topic: string;
  payload: T;
  status: "pending" | "sent" | "failed";
  attempts: number;
  createdAt: number;
  lastError?: string;
  nextAttemptAt?: number;
}

/** Outbox ストア(実体は DB テーブル)。 */
export interface OutboxStore {
  /** 送信対象(pending かつ nextAttemptAt 到来分)を取り出す。 */
  fetchPending(limit: number, now: number): Promise<OutboxMessage[]> | OutboxMessage[];
  /** 送信成功を記録。 */
  markSent(id: string): Promise<void> | void;
  /** 送信失敗を記録(次回試行時刻つき)。 */
  markFailed(id: string, error: string, attempts: number, nextAttemptAt?: number): Promise<void> | void;
}

/** メッセージ送信関数(実際の配信先: Zoho/メール/webhook 等)。 */
export type OutboxDispatcher = (message: OutboxMessage) => Promise<void>;

/** リレー設定。 */
export interface RelayOptions {
  /** 一度に処理する件数(既定 20)。 */
  batchSize?: number;
  /** 最大試行回数(超えたら failed 確定・既定 5)。 */
  maxAttempts?: number;
  /** 再試行バックオフ(ms)を返す(既定: 指数 1s,2s,4s...)。 */
  backoffMs?: (attempts: number) => number;
  now?: () => number;
}

/** 1 バッチ分をリレーする。処理結果の集計を返す。 */
export async function relayOutbox(store: OutboxStore, dispatch: OutboxDispatcher, options: RelayOptions = {}): Promise<{ sent: number; failed: number; exhausted: number }> {
  const batchSize = options.batchSize ?? 20;
  const maxAttempts = options.maxAttempts ?? 5;
  const backoffMs = options.backoffMs ?? ((n: number) => 1000 * 2 ** (n - 1));
  const now = options.now ?? (() => Date.now());

  const pending = await store.fetchPending(batchSize, now());
  let sent = 0, failed = 0, exhausted = 0;

  for (const msg of pending) {
    try {
      await dispatch(msg);
      await store.markSent(msg.id);
      sent += 1;
    } catch (e) {
      const attempts = msg.attempts + 1;
      const error = e instanceof Error ? e.message : String(e);
      if (attempts >= maxAttempts) {
        await store.markFailed(msg.id, error, attempts, undefined); // これ以上再試行しない
        exhausted += 1;
      } else {
        await store.markFailed(msg.id, error, attempts, now() + backoffMs(attempts));
        failed += 1;
      }
    }
  }
  return { sent, failed, exhausted };
}

/** メモリ Outbox ストア(テスト・単一プロセス用)。 */
export function createMemoryOutboxStore(now: () => number = () => Date.now()): OutboxStore & { add(topic: string, payload: unknown): OutboxMessage; all(): OutboxMessage[] } {
  const messages: OutboxMessage[] = [];
  let seq = 0;
  return {
    add(topic, payload) {
      const msg: OutboxMessage = { id: `msg-${++seq}`, topic, payload, status: "pending", attempts: 0, createdAt: now() };
      messages.push(msg);
      return msg;
    },
    all: () => messages,
    fetchPending(limit, t) {
      return messages.filter((m) => m.status === "pending" && (m.nextAttemptAt === undefined || m.nextAttemptAt <= t)).slice(0, limit);
    },
    markSent(id) { const m = messages.find((x) => x.id === id); if (m) m.status = "sent"; },
    markFailed(id, error, attempts, nextAttemptAt) {
      const m = messages.find((x) => x.id === id);
      if (m) { m.attempts = attempts; m.lastError = error; m.nextAttemptAt = nextAttemptAt; m.status = nextAttemptAt === undefined ? "failed" : "pending"; }
    },
  };
}
