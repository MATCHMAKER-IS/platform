# @platform/jobs

非同期ジョブ(キュー)の共通部品。重い処理・遅延処理をリクエストから切り離します
(内部は BullMQ + Redis)。

```ts
import { createQueue, createWorker } from "@platform/jobs";

// 投入側(アプリ)
const emails = createQueue<{ to: string }>("emails", { url: env.REDIS_URL });
await emails.add("welcome", { to: "a@example.co.jp" });

// 処理側(ワーカープロセス)
createWorker<{ to: string }>("emails", async (job) => {
  await mailer.sendMail({ to: job.data.to, subject: "ようこそ", text: "..." });
}, { url: env.REDIS_URL });
```

既定で指数バックオフ 3 回の再試行が入ります。

## ブラウザから使う入口(`@platform/jobs/browser`)

バレル(`@platform/jobs`)は **BullMQ** を読み込みます。BullMQ は `child_process` /
`worker_threads` / `net` / `fs` を使うため、`"use client"` から import すると
**`next build` が「Module not found: Can't resolve 'child_process'」で落ちます**。
型検査も lint も smoke も通るので、原因が分かりにくい種類の失敗です。

```tsx
"use client";
import { createMemoryQueue, defineJob } from "@platform/jobs/browser";
```

含むもの: `createMemoryQueue` / `defineJob`(**呼び出し方は BullMQ 版と同じ**)。
含まないもの: `createQueue` / `createWorker`(BullMQ。サーバ専用)。
