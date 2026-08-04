/**
 * `@platform/sms` — SMS / 電話(SMS 送信)の共通部品(Adapter パターン)。
 *
 * アプリは送信基盤(Twilio 等)を意識せず `sendSms()` を呼ぶ。
 * `mail` と同じ構造で、Transport を差し替えても呼び出し側は無変更。
 *
 * **ブラウザ・クライアントコンポーネントからは `@platform/sms/browser` を使うこと。**
 * このバレルは Twilio SDK を再 export するため、`"use client"` から読むと
 * `next build` が落ちる。
 *
 * @packageDocumentation
 */

export * from "./core";
export { createTwilioTransport, type TwilioConfig } from "./transports/twilio";
export { createMemoryTransport, type MemorySmsTransport } from "./transports/memory";

export * from "./segment";
export { withSmsRetry, createFallbackSmsTransport, type SmsRetryOptions, type SmsFallbackOptions } from "./resilient";
export * from "./otp-message";
