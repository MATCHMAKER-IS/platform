/**
 * `@platform/cron/browser` — **node: に依存しない**部分だけを出す入口。
 *
 * バレル(`@platform/cron`)は `lock-file.ts`(`node:fs`)を再 export するため、
 * `"use client"` から import すると **Turbopack が `node:fs` を解決できずビルドが落ちる**:
 *
 *   the chunking context does not support external modules (request: node:fs)
 *
 * 多重実行防止・分散ロック・実行統計は node に依存しないので、
 * 画面から使いたい場合(管理画面でジョブの状態を見せる等)はこちらを使う。
 * **cron 式の解析(croner)とファイルロックはサーバ専用**なので、ここには含めない。
 *
 * @example
 * ```tsx
 * "use client";
 * import { createGuardedJob, createMemoryLockStore } from "@platform/cron/browser";
 * ```
 * @packageDocumentation
 */
export { createGuardedJob, type JobStats, type JobResult, type GuardOptions } from "./runner";
export { createMemoryLockStore, type LockStore } from "./lock";
