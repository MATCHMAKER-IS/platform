# @platform/net

通信の下支え（再試行の待ち時間・タイムアウト・回線の状態）。

## これは何のためか

**外部への呼び出しが失敗したときの「待ち方」**を決めるものです。

**すぐ繰り返すと、相手の混雑を悪化させます**——
**自分たちで自分たちを詰まらせる**ことになります。

## 使う前に知っておくこと

| | |
|---|---|
| **ばらつき（jitter）を必ず入れる** | 入れないと、**混雑で失敗した全員が同じ秒数で再開し、また一斉に混みます** |
| **回数は 0 始まり** | 1 回目の待ち時間は `backoffDelay(0)` です——**1 を渡すと最初から長く待ちます** |
| **上限を必ず決める** | 指数で伸びるので、**5 回で 30 秒以上**になります |
| **タイムアウトは 2 種類** | **1 回の試行**と**全体**です。再試行するなら、**その回数分だけ積算**されます |

## よく使うもの

```ts
import { backoffDelay, withTimeout } from "@platform/net";
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
