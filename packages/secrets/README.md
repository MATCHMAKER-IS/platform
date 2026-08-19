# @platform/secrets

秘密情報の取得（環境変数・外部サービス）。**取得元を差し替えられます**。

## これは何のためか

**鍵を 1 か所にまとめる**ためのものです。

`.env` に散らばると、**入れ替えるときに全部を探す**ことになります。

## 使う前に知っておくこと

| | |
|---|---|
| **毎回外部サービスを叩かない** | 起動時に取って**持っておいて**ください——**呼ぶたびに料金と遅延**がかかります |
| **外部サービスが落ちたら起動できません** | `.env` を残して**併用**するか、**取れなかったときの動き**を決めておいてください |
| **ログに出さない** | 取り出した値は**そのまま秘密**です——`console.log` は伏せ字を通りません |
| **保存しない** | DB やファイルに写すと、**まとめている意味がなくなります** |
| **入れ替えの手順を決めておく** | 「鍵が漏れた」ときに、**何分で入れ替えられるか**が被害を決めます。手順は `docs/ops/SECRET_ROTATION.md` にあります |

## よく使うもの

```ts
import { createSecretStore, createEnvProvider, createFetchProvider } from "@platform/secrets";
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
