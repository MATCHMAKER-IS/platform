# @platform/testing

テストの補助（固定した時刻・連番・ダミーの応答）。

## これは何のためか

**テストが毎回違う結果になると、失敗を再現できません。**

「たまに落ちる」テストは、**やがて誰も見なくなります**。

## 使う前に知っておくこと

| | |
|---|---|
| **テストで `new Date()` を使わない** | 実行するたびに変わります——**月末や年末だけ落ちる**テストになります |
| **ID は連番で** | ランダムだと、**失敗したときに再現できません** |
| **本番のコードに入れない** | 検査で見張っていますが、**書けてしまいます** |
| **外部への呼び出しは差し替える** | 本物を叩くと、**遅く、不安定で、料金がかかります** |

## よく使うもの

```ts
import { runCacheContract, runStorageContract, testId } from "@platform/testing";
import { createCache, createMemoryCache } from "@platform/cache";
import { runCacheContract } from "@platform/testing";
runCacheContract("memory", () => createCache(createMemoryCache()));
```
