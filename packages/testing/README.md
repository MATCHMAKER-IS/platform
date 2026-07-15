# @platform/testing

テスト支援ツール。

- **ファクトリ**: `fakeAuthUser` / `fakeSession` / `testId` / `fixedDate`
- **契約テスト**: `runCacheContract` / `runStorageContract` … アダプタ実装が満たすべき
  振る舞いを共通化。新しいアダプタもこの契約に通れば既存と同じ挙動を保証できる。

```ts
import { createCache, createMemoryCache } from "@platform/cache";
import { runCacheContract } from "@platform/testing";
runCacheContract("memory", () => createCache(createMemoryCache()));
```
