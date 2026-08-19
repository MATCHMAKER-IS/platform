# @platform/ratelimit

回数の上限（ログイン試行・API 呼び出し）。**短時間の繰り返しを止めます**。

## これは何のためか

**繰り返されると困るもの**を守ります——
ログインの総当たり、重い集計の連打、外部 API の呼びすぎ。

## 使う前に知っておくこと

| | |
|---|---|
| **鍵の決め方が要です** | **IP だけで数えると、同じ会社の全員が 1 人分**になります（社内からは同じ IP に見えます）——**利用者 ID と組み合わせて**ください |
| **メモリ実装は 1 プロセスまで** | 2 台構成だと**上限が実質 2 倍**になります。台数を増やすなら Redis 実装へ |
| **Redis 実装は import に注意** | サーバ処理から直接読むと **`next build` が落ちます**——動的 import を使ってください |
| **上限に当たった人に理由を伝える** | 「エラー」だけだと、**何度も試して余計に詰まります** |

## よく使うもの

```ts
import { createRateLimiter, createMemoryStore, createRedisStore } from "@platform/ratelimit";
import { createRateLimiter, createRedisStore } from "@platform/ratelimit";
const limiter = createRateLimiter({ store: createRedisStore(env.REDIS_URL), limit: 5, windowSeconds: 60 });
const res = await limiter.check(`login:${email}`);
if (res.ok && !res.value.allowed) {
  // 429 を返す等
}
```

## ブラウザから使う入口(`@platform/ratelimit/browser`)

バレル(`@platform/ratelimit`)は **ioredis** を読み込みます。ioredis は
`dns` / `net` / `tls` / `fs` を使うため、バンドル対象に入ると **`next build` が落ちます**。

```ts
import { createRateLimiter, createMemoryStore } from "@platform/ratelimit/browser";
```

含むもの: 上限の判定とメモリ実装。
含まないもの: `createRedisStore`(ioredis。サーバ専用)。

> **複数インスタンスで動かすなら Redis 実装が要ります。** メモリ実装はプロセスごとに
> 数えるため、**台数分だけ上限が緩くなります**(3 台なら実質 3 倍)。
