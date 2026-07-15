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
