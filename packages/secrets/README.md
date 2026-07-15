# @platform/secrets

シークレット取得の抽象。環境変数の平文直読みを避け、取得元(env / AWS Secrets Manager / Vault)を
差し替え可能にします。TTL キャッシュでローテーションに追随し、必須チェックも提供します。

```ts
import { createSecretStore, createChainProvider, createEnvProvider, createFetchProvider } from "@platform/secrets";

// env を優先しつつ、無ければ Secrets Manager を見る
const store = createSecretStore(createChainProvider([
  createEnvProvider(),
  createFetchProvider(async (name) => (await secretsManager.get(name)).value),
]), { ttlMs: 5 * 60_000 });

const dbUrl = await store.require("DATABASE_URL"); // 未設定なら例外
store.invalidate("DATABASE_URL");                   // ローテーション直後に再取得させる
```

値はログに出さない前提で扱います(`@platform/logger` の redact と併用)。
