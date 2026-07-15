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
