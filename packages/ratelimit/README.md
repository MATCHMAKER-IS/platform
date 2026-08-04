# @platform/ratelimit

レート制限(固定ウィンドウ)。ログイン試行や API 濫用の抑止に使います。

- `createMemoryStore()` … 単一インスタンス・開発向け
- `createRedisStore(url)` … 複数インスタンス・本番向け(原子的カウント)

```ts
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
