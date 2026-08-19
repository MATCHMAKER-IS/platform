# @platform/cache

キャッシュ（メモリ・タグ無効化・TTL）。

## これは何のためか

**同じ計算を何度もしないため**のものです。
100 人が同じ一覧を開けば、**100 回同じクエリが飛びます**。

ただし**キャッシュは古いデータを見せます**——
**「速いが間違っている」より「遅いが正しい」方がまし**な場面があります。

## 使う前に知っておくこと

| | |
|---|---|
| **人によって変わるものは鍵に利用者を** | 含めないと**他人のデータが見えます**。これは事故です |
| **壊れた値は「無い」として扱います** | **落とすより取り直す**方が安全なためです |
| **タグの並び順に依存しません** | `["a","b"]` と `["b","a"]` は同じ扱いです |
| **消し忘れが一番多い** | 更新したら**必ず無効化**してください——**古い金額が出続けます** |
| **メモリ実装は 1 台まで** | 2 台構成だと**片方だけ古いまま**になります |

## よく使うもの

```ts
import { createMemoryCache, createRedisCache, createCache } from "@platform/cache";
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
