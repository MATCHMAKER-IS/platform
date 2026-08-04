# @platform/net

ネットワークユーティリティ。指数バックオフ・タイムアウト・IP/CIDR 判定に加え、
TCP フレーミング・WebSocket フレーム・SSE・UDP など低レベルのプロトコル部品を提供します。

```ts
import { withTimeout, backoffDelay, ipInCidr, isPrivateIp } from "@platform/net";

await withTimeout(fetch(url), 5000);        // 応答なしで詰まるのを防ぐ
backoffDelay(3);                             // 指数バックオフの待機ミリ秒
ipInCidr("10.0.0.5", "10.0.0.0/8");          // true(社内ネット判定など)
```

`withTimeout` は外部連携の詰まり防止に。IP/CIDR 判定はアクセス制御・監査に使えます。

## ブラウザから使う入口(`@platform/net/browser`)

バレル(`@platform/net`)は TCP/UDP を含むため `node:net` / `node:dgram` を引き込みます。
クライアントコンポーネントから読むとバンドラが解決できずビルドが落ちるので、
**Node の API に触れないモジュールだけ**をこちらから提供します。

```ts
"use client";
import { backoffDelay, retry, ipInCidr, poll } from "@platform/net/browser";
```

含むもの: 指数バックオフ・リトライ・タイムアウト / IP・CIDR 判定 / SSE 解析 /
WebSocket フレーム / 長さ前置きフレーミング / ポーリング。
含まないもの: TCP・UDP(サーバ側でのみ使います)。

> **URL の組み立てはここではありません。** `buildQuery` などは `@platform/url` にあります
> (以前 `@platform/net` にあったものを移しました)。
