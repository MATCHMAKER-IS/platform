/**
 * DB(SQL)ベースの Outbox ストア(本番実装)。業務データと同一トランザクションで
 * メッセージを保存し、別プロセスのリレーが確実に送る。永続化されるので再起動でも失われない。
 *
 * observability は依存ゼロを保つため、実際の DB アクセスは注入された {@link OutboxDbClient}
 * に委譲する(アプリ側が Prisma で実装)。想定テーブルは下記 SQL 参照。
 *
 * ```sql
 * CREATE TABLE outbox_messages (
 *   id             TEXT PRIMARY KEY,
 *   topic          TEXT NOT NULL,
 *   payload        JSONB NOT NULL,
 *   status         TEXT NOT NULL DEFAULT 'pending',   -- pending | sent | failed
 *   attempts       INT  NOT NULL DEFAULT 0,
 *   last_error     TEXT,
 *   next_attempt_at BIGINT,                           -- epoch ms(NULL=即時)
 *   created_at     BIGINT NOT NULL
 * );
 * CREATE INDEX idx_outbox_pending ON outbox_messages (status, next_attempt_at);
 * ```
 * @packageDocumentation
 */
import type { OutboxMessage, OutboxStore } from "./outbox.js";

/** DB アクセスの最小インターフェース(アプリが Prisma 等で実装)。 */
export interface OutboxDbClient {
  /** メッセージを1件挿入(業務トランザクションと同一 tx で呼ぶのが理想)。 */
  insert(message: OutboxMessage): Promise<void>;
  /** pending かつ next_attempt_at <= now の行を limit 件、古い順に取得。
   *  可能なら SELECT ... FOR UPDATE SKIP LOCKED で複数ワーカーの競合を避ける。 */
  selectPending(limit: number, now: number): Promise<OutboxMessage[]>;
  /** status='sent' に更新。 */
  updateSent(id: string): Promise<void>;
  /** 失敗を記録(attempts/last_error/next_attempt_at/status を更新)。 */
  updateFailed(id: string, error: string, attempts: number, nextAttemptAt: number | undefined, status: "pending" | "failed"): Promise<void>;
}

/** DB Outbox ストア(add で積み、リレーが fetchPending→markSent/markFailed)。 */
export interface SqlOutboxStore extends OutboxStore {
  /** メッセージを積む。id は自動採番(uuid など、client 側の insert で確定してもよい)。 */
  add(topic: string, payload: unknown): Promise<OutboxMessage>;
}

/**
 * DB Outbox ストアを作る。
 * @param client DB アクセス実装(アプリの Prisma ラッパー)
 * @param genId  ID 生成関数(既定: 時刻+乱数。運用では uuid 推奨)
 * @param now    現在時刻(テスト用)
 */
export function createSqlOutboxStore(
  client: OutboxDbClient,
  genId: () => string = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  now: () => number = () => Date.now(),
): SqlOutboxStore {
  return {
    async add(topic, payload) {
      const message: OutboxMessage = { id: genId(), topic, payload, status: "pending", attempts: 0, createdAt: now() };
      await client.insert(message);
      return message;
    },
    fetchPending: (limit, t) => client.selectPending(limit, t),
    markSent: (id) => client.updateSent(id),
    markFailed: (id, error, attempts, nextAttemptAt) =>
      client.updateFailed(id, error, attempts, nextAttemptAt, nextAttemptAt === undefined ? "failed" : "pending"),
  };
}
