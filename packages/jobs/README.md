# @platform/jobs

非同期の仕事（キュー・再試行・進捗）。**重い処理を後回し**にします。

## これは何のためか

**画面を待たせないため**です。

100 件の PDF 生成を画面から実行すると、**数分間なにも返りません**——
利用者は**壊れたと思って何度も押します**。

## 使う前に知っておくこと

| | |
|---|---|
| **メモリ実装は再起動で消えます** | 途中の仕事も**消えます**——**やり直せる形**にしてください |
| **終わった仕事は消す** | **永久に保持すると溜まり続けます**。ただし**失敗したものは残して**ください——原因が分からなくなります |
| **同じ仕事を二重に実行しない** | 押し間違いで 2 回入ると、**通知が 2 回届きます**。**冪等キー**を使ってください |
| **失敗を数える** | 「動いていて当たり前」なので、**止まっても誰も報告してきません** |

## よく使うもの

```ts
import { defineJob, connectionFromUrl, createQueue } from "@platform/jobs";
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
