/**
 * ブラウザ・クライアントコンポーネントから使う入口。
 *
 * バレル(`@platform/sms`)は **Twilio SDK** を読み込む。Twilio は
 * `fs` / `net` / `tls` を(`node:` 接頭辞なしで)require するため、
 * `"use client"` から import すると **`next build` が落ちる**。
 *
 * **`./index` ではなく `./core` を参照する。**
 * index は twilio を再 export しているので、そこを経由した時点で
 * 同じ問題が起きる(実際に一度この形で落とした)。
 *
 * 含まないもの: `createTwilioTransport`(サーバ専用)。
 *
 * @packageDocumentation
 */
export * from "./core";
export { createMemoryTransport, type MemorySmsTransport } from "./transports/memory";
export * from "./segment";
export * from "./otp-message";
