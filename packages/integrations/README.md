# @platform/integrations

外部サービス連携の土台（HTTP クライアント・再試行・時間制限）。

## これは何のためか

**外部サービスは必ず落ちます。**
Zoho も freee も Slack も、**メンテナンスがあり、混雑があります**。

このパッケージは、**全部の連携で同じ守り方をする**ためのものです。

## 使う前に知っておくこと

| | |
|---|---|
| **時間制限は 2 種類** | **1 回の試行**（既定 10 秒）と、**再試行を含む全体**（既定 30 秒）です。**再試行するなら、その回数分だけ積算**されます |
| **`POST` は既定で試し直しません** | 「作成は成功したが応答が返らなかった」ときに繰り返すと、**同じ請求書が 2 通**できます |
| **1 回の呼び出しで 30 秒以上かかるなら設計を見直す** | 相手が遅いのではなく、**取りすぎている**ことが多いです |
| **相手のエラーをそのまま出さない** | 「500 Internal Server Error」と見せても、**利用者にはどうしようもありません** |

## よく使うもの

```ts
import { createApiClient } from "@platform/integrations";
import { createApiClient } from "@platform/integrations";
const api = createApiClient({
  baseUrl: "https://api.example.com/v1",
  headers: { Authorization: `Bearer ${token}` },
});
const res = await api.get<User[]>("/users", { query: { active: true } });
```

個別サービス(会計 SaaS 等)の連携は、このクライアントを使ってアプリ側 or
専用パッケージで実装します。失敗は `AppError`(コード `EXTERNAL`)に統一されます。
