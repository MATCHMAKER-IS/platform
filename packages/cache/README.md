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

## タグによる一括無効化(`@platform/cache/tagged`)

`createCache` はキー単位で消します。ですが実務で必要になるのは
**「関連するものをまとめて消す」**方です(取引先を更新したら、その取引先に関する
すべてのキャッシュを消したい)。キーを列挙して消そうとすると必ず消し忘れます。
どこでキャッシュしたかを全部覚えている人はいません。

```ts
import { createTaggedCache, tag } from "@platform/cache/tagged";

const tc = createTaggedCache(cache);
await tc.getOrSet("quote:1001", 300, [tag("customer", 42)], () => buildQuote(1001));

// 取引先 42 を更新した → 42 に紐づくものが**まとめて**無効になる
await tc.invalidate(tag("customer", 42));
```

タグごとに**世代番号**を持ち、キャッシュキーに混ぜています。無効化は番号を 1 つ進めるだけで、
古い番号のキーは二度と参照されず TTL で自然に消えます(削除して回らないので速い)。
