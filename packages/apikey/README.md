# @platform/apikey

API キーの発行と検証。**外部システムから呼ばせる**ときに使います。

## これは何のためか

**人ではないもの（他システム・スクリプト）を認証する**ためのものです。

ログインのセッションとは**別**です——
**キーは長生きし、画面を持ちません**。

## 使う前に知っておくこと

| | |
|---|---|
| **平文は発行時にしか返りません** | **その場で控えてもらってください**——後から見せる手段はありません（ハッシュしか保存していません） |
| **接頭辞を付けています** | `pk_live_` のような形で、**用途と環境が見分けられます**——**本番の鍵を開発機に貼る事故**を防ぎます |
| **期限を必ず入れる** | 無期限のキーは、**退職者が持ったままになります** |
| **権限は最小に** | キーが漏れたときの被害が、**そのまま権限の広さ**です |
| **使われていないキーは消す** | 「いつか使うかも」で残すと、**誰のものか分からなくなります** |

## よく使うもの

```ts
import { hashApiKey, generateApiKey, verifyApiKey } from "@platform/apikey";
import { generateApiKey, authenticateApiKey, hasScope } from "@platform/apikey";

// 発行(平文は1回だけ返す。DB にはハッシュを保存)
const key = generateApiKey({ prefix: "sk_live_" });
// key.plaintext を利用者へ / key.hash を保存

// 認証(ハッシュで引き当て・失効/期限チェック)
const auth = await authenticateApiKey(req.headers["x-api-key"], store);
if (auth.ok && hasScope(auth.record.scopes, "orders:write")) { /* 許可 */ }
```

スコープはワイルドカード対応(`orders:*` / `*`)。照合はタイミング攻撃対策済み。
