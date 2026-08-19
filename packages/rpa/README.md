# @platform/rpa

定型作業の自動化（手順の記録・再実行）。

## これは何のためか

**同じ作業を繰り返さない**ためのものです。

毎月同じ画面から同じデータを取る——
**人がやると忘れるし、間違えます**。

## 使う前に知っておくこと

| | |
|---|---|
| **記録済みのキーは飛ばします** | 途中で止まっても、**やり直せば続きから**進みます |
| **失敗したらキーを記録しない** | 記録すると、**次回に飛ばされて、永久にやり直されません** |
| **必ず解放する** | ロックや接続は `finally` で——**残ると次回が動きません** |
| **画面の変更で壊れます** | 相手のサイトが変われば**動かなくなります**——**壊れたことに気づける**ようにしてください |
| **人がやることを減らすもの** | **人の判断が要るものは自動化しない**でください |

## よく使うもの

```ts
import { createRpaRunner } from "@platform/rpa";
import { createRpaRunner } from "@platform/rpa";
import { createFileLockStore } from "@platform/cron";       // 単一ホスト。複数なら createRedisLockStore
import { appendEvent } from "@platform/audit";

const runner = createRpaRunner({
  lock: createFileLockStore(".cache/rpa"),
  audit: (e) => { auditLog = appendEvent(auditLog, e); },   // 監査へ
});

const res = await runner.run({
  name: "point-sync",
  lockKey: "chromium",            // 他のブラウザ RPA と直列化
  timeoutMs: 120_000,
  retry: { maxAttempts: 3 },
  idempotencyKey: "2025-01-daily",
  run: async (ctx) => {
    await ctx.audit("open_browser");
    if (ctx.signal.aborted) return;
    // ... 実処理(Playwright 等はアプリ側)...
  },
});
```

`res` は `Result`。失敗理由は `CONFLICT`(ロック取得不可)/ `INTERNAL`(タイムアウト)/ `EXTERNAL`(リトライ上限)で判別できます。
