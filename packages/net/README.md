# @platform/net

ネットワークユーティリティ。URL 操作・指数バックオフ・タイムアウト・IP/CIDR 判定に加え、
TCP フレーミング・WebSocket フレーム・SSE・UDP など低レベルのプロトコル部品を提供します。

```ts
import { withTimeout, backoffDelay, buildQuery, ipInCidr, isPrivateIp } from "@platform/net";

await withTimeout(fetch(url), 5000);        // 応答なしで詰まるのを防ぐ
backoffDelay(3);                             // 指数バックオフの待機ミリ秒
buildQuery({ page: 2, q: "検索" });          // "?page=2&q=..."
ipInCidr("10.0.0.5", "10.0.0.0/8");          // true(社内ネット判定など)
```

`withTimeout` は外部連携の詰まり防止に。IP/CIDR 判定はアクセス制御・監査に使えます。
