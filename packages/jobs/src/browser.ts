/**
 * ブラウザ・クライアントコンポーネントから使う入口。
 *
 * バレル(`@platform/jobs`)は **BullMQ** を読み込む。BullMQ は
 * `child_process` / `worker_threads` / `net` / `fs` を使うため、
 * `"use client"` から import すると **`next build` が
 * 「Module not found: Can't resolve 'child_process'」で落ちる**。
 * 型検査も smoke も通るのに build だけが落ちるので、原因が分かりにくい。
 *
 * メモリ実装とジョブ定義は Node の API に触れないので、ここから提供する。
 * **呼び出し方は BullMQ 版と同じ**(それが Adapter パターンの要点)。
 *
 * 含まないもの: `createQueue` / `createWorker`(BullMQ。サーバ専用)。
 *
 * @packageDocumentation
 */
export { createMemoryQueue, type MemoryQueue, type MemoryQueueOptions, type FailedJob } from "./memory";
export { defineJob, type JobDefinition } from "./define";
