/**
 * アプリで使う基盤部品をここで初期化して配線する。
 * 各部品の「作り方」を知るのはこのファイルだけ。以降は import して使う。
 * @packageDocumentation
 */
import { createLogger } from "@platform/logger";
// このアプリ専用の生成物(prisma/schema.prisma の output で生成される)。
// **型ではなく実体を import する。** 型だけ渡しても、基盤が new するのは
// 別の生成物になり、このアプリのモデルを持たない(2026-08 に実際に起きた)
import { PrismaClient } from "../generated/prisma";
import { logContext } from "./log-context";
import { createDb } from "@platform/db";
import { summarizeSql } from "@platform/debug";
import { debugCollector } from "./debug-collector";
import { createMailer, createSmtpTransport, withMailRetry } from "@platform/mail";
import { createMemoryOutboxStore } from "@platform/observability";
import { createMemorySeenStore } from "@platform/notify";
import { env, featureEnv } from "./env";

export const log = createLogger({ level: env.LOG_LEVEL, base: { service: "internal-app" }, contextProvider: logContext.provider });

/**
 * DB クライアント。Platform Debugger が有効なときだけ SQL を記録する
 * (`onQuery` を渡すと Prisma のクエリログが有効になるため、本番では渡さない)。
 *
 * **型引数にこのアプリの生成物を渡す。** schema はアプリごとに分かれており
 * (ADR-0006)、生成先も `src/generated/prisma` に分けてある。
 * 渡さないと `@prisma/client`(= 最後に generate した schema)の型になり、
 * `db.expense` などが「存在しない」と言われる。
 */
export const db = createDb(
  PrismaClient,
  env.DATABASE_URL,
  featureEnv.DEBUG_TOOL
    ? {
        onQuery: (q) => {
          // リクエスト外(起動時の初期化など)は requestId が無いので記録しない
          const requestId = logContext.get()?.traceId;
          if (typeof requestId !== "string") return;
          debugCollector.record(requestId, {
            kind: "sql",
            label: summarizeSql(q.query),
            durationMs: q.durationMs,
            ok: true,
          });
        },
      }
    : {},
);

export const mailer = createMailer({
  // 一時障害を指数バックオフで再試行(SMTP のスパイクや瞬断を吸収)。
  transport: withMailRetry(createSmtpTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT }), { retries: 2 }),
  defaultFrom: env.MAIL_FROM,
});

/**
 * 通知の Outbox(確実送信)。承認処理と同じ流れでメッセージを積み、リレーが確実に届ける。
 * 実運用では DB テーブルに置き換える(ここではプロセス内メモリ実装)。
 */
export const notifyOutbox = createMemoryOutboxStore();

/** 重複通知の抑制ストア(同じ遷移の再処理で二重送信しない)。 */
export const notifySeen = createMemorySeenStore();

// 辞書(RAG 検索・文字起こしの表記統一)を DB 永続化する。
// db の glossaryReplacement / glossaryTerm デリゲートを注入(Prisma スキーマに対応モデルあり)。
import { configureDictionaryDb } from "./rag-service";
import type { DictionaryDb } from "./dictionary-store";
configureDictionaryDb(db as unknown as DictionaryDb);
