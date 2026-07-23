/**
 * `@platform/net/browser` — ブラウザでも読み込める部分だけを再輸出する入口。
 *
 * バレル(`@platform/net`)は TCP/UDP を含むため `node:net` / `node:dgram` を引き込む。
 * クライアントコンポーネントから読むとバンドラが解決できずビルドが落ちるので、
 * **Node の API に触れないモジュールだけ**をここから提供する。
 *
 * 含むもの: URL 組み立て / 指数バックオフ / IP・CIDR 判定 / SSE 解析 /
 *           WebSocket フレーム / 長さ前置きフレーミング / ポーリング。
 * 含まないもの: TCP(`tcp.ts`) と UDP(`udp.ts`)。これらはサーバ側でのみ使う。
 *
 * @packageDocumentation
 */
export * from "./backoff";
export * from "./ip";
export * from "./sse";
export * from "./ws-frame";
export * from "./framing";
export * from "./poll";
