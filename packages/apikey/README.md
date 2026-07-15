# @platform/apikey

API キー / マシン間(M2M)認証。サービス間連携・外部システム向けのキー発行・検証・スコープ制御。
キーは平文を保存せず SHA-256 ハッシュで照合します。

```ts
import { generateApiKey, authenticateApiKey, hasScope } from "@platform/apikey";

// 発行(平文は1回だけ返す。DB にはハッシュを保存)
const key = generateApiKey({ prefix: "sk_live_" });
// key.plaintext を利用者へ / key.hash を保存

// 認証(ハッシュで引き当て・失効/期限チェック)
const auth = await authenticateApiKey(req.headers["x-api-key"], store);
if (auth.ok && hasScope(auth.record.scopes, "orders:write")) { /* 許可 */ }
```

スコープはワイルドカード対応(`orders:*` / `*`)。照合はタイミング攻撃対策済み。
