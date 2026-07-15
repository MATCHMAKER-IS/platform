# @platform/integrations

外部サービス連携の共通土台。型付き HTTP クライアントを提供します
(タイムアウト・リトライ・エラー正規化を内蔵)。

```ts
import { createApiClient } from "@platform/integrations";
const api = createApiClient({
  baseUrl: "https://api.example.com/v1",
  headers: { Authorization: `Bearer ${token}` },
});
const res = await api.get<User[]>("/users", { query: { active: true } });
```

個別サービス(会計 SaaS 等)の連携は、このクライアントを使ってアプリ側 or
専用パッケージで実装します。失敗は `AppError`(コード `EXTERNAL`)に統一されます。
