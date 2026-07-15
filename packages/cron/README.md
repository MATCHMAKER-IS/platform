# @platform/cron

定期実行(スケジューラ)の共通部品。内部は croner。既定タイムゾーンは Asia/Tokyo。

```ts
import { createScheduler } from "@platform/cron";
const scheduler = createScheduler(
  [{ name: "daily-report", schedule: "0 9 * * *", handler: async () => { await buildReport(); } }],
  (name, err) => log.error({ name, err }, "cron失敗"),
);
scheduler.start();
```

**複数インスタンス注意**: 同時刻に重複実行されます。冗長構成では `@platform/jobs`
(BullMQ)の repeatable job を使うか、1 台に限定してください。

## ファイルベースのプロセス間ロック

Redis を使わず、単一ホスト上で複数プロセス(RPA・バッチ)を直列化します(社内 membership-extender の Chromium 直列化ロックを一般化)。PID 死活監視 + stale 時刻で死んだロックを自動回収します。

- `acquireFileLock(file, label)`: 待機付き取得 → 解放関数を返す(タイムアウトで例外)
- `tryAcquireFileLock` / `releaseFileLock`: 待機なしの取得/解放
- `createFileLockStore(dir)`: cron の `LockStore` として使える(単一ホストで Redis の代わり)

```ts
const release = await acquireFileLock(".cache/rpa.lock", "point-sync");
try { await runRpa(); } finally { release(); }
```

分散(複数インスタンス)環境では `createRedisLockStore` を、単一ホストでは `createFileLockStore` を選びます。
