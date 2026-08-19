/**
 * `@platform/net` — ネットワークユーティリティ(URL/リトライ/IP)とソケット(TCP フレーミング)。
 * @packageDocumentation
 */
export * from "./backoff";
export * from "./ip";
export * from "./framing";
export * from "./tcp";
export * from "./udp";
export * from "./ws-frame";
export * from "./sse";
export * from "./poll";

/**
 * 外向きの通信先が安全かを見る(SSRF 対策)。
 *
 * **利用者が指定した URL をそのまま叩くと踏み台になる。**
 */
export {
  isSafeExternalUrl,
  describeUnsafeReason,
} from "./safe-target";
export type { SafeUrlOptions, UnsafeReason } from "./safe-target";
