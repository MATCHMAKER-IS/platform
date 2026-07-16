/**
 * `@platform/ekyc` — eKYC(オンライン本人確認)ベンダー連携。
 * 汎用クライアント + TRUSTDOCK プリセット、判定 Webhook の署名検証・パース、ステータス正規化。
 * 判定そのものはベンダーが行い、基盤は API 呼び出しと結果の正規化を担う。
 * @packageDocumentation
 */
export * from "./client";
export * from "./status";
export * from "./webhook";
