/**
 * アプリで使う基盤部品をここで初期化して配線する。
 * 各部品の「作り方」を知るのはこのファイルだけ。以降は import して使う。
 * @packageDocumentation
 */
import { optionalEnv, isProductionRuntime } from "@platform/env";
import { createLogger } from "@platform/logger";
// このアプリ専用の生成物(prisma/schema.prisma の output で生成される)。
// **型ではなく実体を import する。** 型だけ渡しても、基盤が new するのは
// 別の生成物になり、このアプリのモデルを持たない(2026-08 に実際に起きた)
import { PrismaClient } from "../generated/prisma";
import { logContext } from "./log-context";
import { createDb, createSlowQueryLog } from "@platform/db";
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
// **本番でも有効にできる。** 既定は無効——
// `onQuery` はわずかに遅くなるので、**必要なときだけ**入れます。
const slowQueryLogEnabled = optionalEnv("SLOW_QUERY_LOG") === "1";

export const db = createDb(
  // **`new` はここでする。** クラスを基盤へ渡すと、Prisma がモデルの型を
  // 決められず `findUnique` の戻り値が `{}` になる(2026-08)
  (o) => new PrismaClient(o),
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
    : slowQueryLogEnabled
      ? {
          // **本番でも遅いクエリだけは記録する。**
          //
          // 【なぜ既定で有効にしないか】
          // `onQuery` を渡すと **Prisma のクエリログが有効**になり、
          // **わずかに遅くなります**。常時ではなく、
          // **「遅い」と言われたときに `SLOW_QUERY_LOG=1` で有効化**する使い方です。
          //
          // 【デバッグツールとは別】
          // `DEBUG_TOOL` は**1 リクエストの全クエリ**を集めます（開発用）。
          // こちらは**しきい値を超えたものだけ**——**本番で常時動かせる**軽さです。
          onQuery: (q) => {
            slowQueryLog.record({
              // **SQL をそのまま渡さない。** 値が入っており、
              // **`WHERE email = '...'` のように個人情報が残ります**。
              label: summarizeSql(q.query),
              durationMs: q.durationMs,
            });
          },
        }
      : {},
);

/**
 * **遅いクエリの記録**（`SLOW_QUERY_LOG=1` のときだけ動きます）。
 *
 * 「なんとなく遅い」を数字にするためのものです——
 * **どのクエリが、何回、どれだけ遅いか**が分かります。
 *
 * 見方は `docs/ops/SLOW_TRIAGE.md` の「どのクエリが遅いか」へ。
 */
export const slowQueryLog = createSlowQueryLog({ thresholdMs: 500 });

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

// **本番でメモリ実装のままなら知らせる。** 2026-08 まで
// 「実運用では DB テーブルに置き換える」と書いてあるだけで、
// **置き換えないまま出たときに何が起きるかが分からなかった**:
//
// - **再起動で未送信の通知が消える**(承認の依頼が届かないまま)
// - **複数インスタンスがそれぞれ別の Outbox を持つ**
//   ——リレーが動くのは片方だけなので、**もう片方の通知は永久に送られない**
//
// 置き換えるには `createSqlOutboxStore` を使う。**`OutboxRow` テーブルが
// まだ無い**ので、マイグレーションが要る(DB 変更を伴うため人の判断で)。
if (isProductionRuntime()) {
  // **複数インスタンスで壊れるものをまとめて挙げる。**
  // 「どれが危ないか」を探し回らずに済むよう、**1 つのログに全部書く**。
  // 台数を増やしたときに初めて壊れるので、**増やす前に気づきたい**
  log.error(
    {
      stores: ["notifyOutbox", "notifySeen", "idempotencyStore", "notifyScheduler.lockStore", "rpaService.lock"],
      risks: {
        notifyOutbox: "再起動で未送信の通知が消える / 複数インスタンスでは片方しか送られない",
        notifySeen: "重複抑制が効かず、同じ通知が台数分届く",
        idempotencyStore: "二重実行を防げないまま「防いでいるつもり」になる",
        lockStore: "定期実行が全インスタンスで走り、通知やレポートが台数分届く",
      },
    },
    "本番なのにメモリ実装のストアがあります。1 台なら動きますが、台数を増やすと壊れます",
  );
}

/** 重複通知の抑制ストア(同じ遷移の再処理で二重送信しない)。 */
export const notifySeen = createMemorySeenStore();
// **これもメモリ実装。** 上の警告に含めてある——
// **インスタンスごとに別の記録**を持つので、
// 2 台構成なら**同じ通知が 2 回届く**(片方は「まだ送っていない」と判断する)。
// 置き換えるには `createRedisSeenStore`(`@platform/notify`)を使う。

// 辞書(RAG 検索・文字起こしの表記統一)を DB 永続化する。
// db の glossaryReplacement / glossaryTerm デリゲートを注入(Prisma スキーマに対応モデルあり)。
import { configureDictionaryDb } from "./rag-service";
import type { DictionaryDb } from "./dictionary-store";
configureDictionaryDb(db as unknown as DictionaryDb);
