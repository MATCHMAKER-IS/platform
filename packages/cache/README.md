# @platform/cache

キャッシュの共通部品(Adapter パターン)。

- `createMemoryCache()` … 単一インスタンス・開発向け(TTL 対応)
- `createRedisCache(config)` … 複数インスタンス・本番向け

```ts
import { createCache, createMemoryCache } from "@platform/cache";
const cache = createCache(createMemoryCache());
const users = await cache.getOrSet("users:list", 60, () => fetchUsers());
```

キャッシュ障害は Result で返り、アプリ本体を巻き込みません。
