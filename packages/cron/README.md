# @platform/cron

定期実行（スケジュール・排他・ずらし）。

## これは何のためか

**夜間バッチ・日次集計・定期通知**のためのものです。

## 使う前に知っておくこと

| | |
|---|---|
| **月末処理に `31` を使わない** | **2 / 4 / 6 / 9 / 11 月に実行されません**——「月末の集計が偶数月だけ来ない」という形で表に出ます。**`L`（月末）**を使ってください |
| **排他ロックを必ず使う** | 2 台構成だと、**両方が同じジョブを走らせます**（通知が 2 回届きます） |
| **発火をずらす** | 全部が 0 時ちょうどに走ると、**その瞬間だけ負荷が跳ねます**。`jitterMs` を入れてください |
| **時刻は JST で考える** | コンテナに `TZ=Asia/Tokyo` が入っていないと、**9 時間ずれて走ります** |
| **止まっても誰も気づきません** | **成功も記録**してください——「動いていない」と「0 件だった」は別です |

## よく使うもの

```ts
import { createScheduler, tryAcquireFileLock, releaseFileLock } from "@platform/cron";
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

## 画面から使う入口(`@platform/cron/browser`)

バレル(`@platform/cron`)は `lock-file.ts`(`node:fs`)を再 export するため、
`"use client"` から import すると **Turbopack が `node:fs` を解決できずビルドが落ちます**
(`the chunking context does not support external modules (request: node:fs)`)。

多重実行防止・分散ロック・実行統計は node に依存しないので、管理画面でジョブの状態を
見せるような用途はこちらを使います。

```tsx
"use client";
import { createGuardedJob, createMemoryLockStore } from "@platform/cron/browser";
```

**cron 式の解析(croner)とファイルロックはサーバ専用**なので、ここには含みません。
