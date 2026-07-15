# @platform/rpa

RPA を**安全に実行するための共通部品**(ランナー骨格)。基盤は RPA 本体(ブラウザ自動操作など)は持ちません。壁打ちの優先順位は **API > MCP > RPA** で、RPA は最後の手段です。

このパッケージは、RPA を回すときに毎回必要になる枠組みだけを提供します:

- **直列化** — 同じ `lockKey` のタスクは同時に走らせない(例: すべてのブラウザ RPA を `"chromium"` で直列化)
- **リトライ** — 指数バックオフ・`isRetryable` 判定
- **冪等** — `idempotencyKey` で「今日の分はもう成功済み」ならスキップ
- **タイムアウト** — 超過で `signal.aborted=true` にし、タスクは早期終了できる
- **監査** — start / success / error / timeout / skip を監査シンクへ

ロック実装と監査シンクは**注入**します(外部依存ゼロ、core のみ)。

```ts
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
