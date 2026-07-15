/**
 * `@platform/social` — ソーシャル(X/TikTok/Instagram)連携の基盤処理。
 * ハンドル正規化・妥当性判定、プロフィール/投稿 URL の解析・生成、oEmbed URL 生成、
 * キャストのアカウント集合の管理。実際の API 取得・投稿はアプリ側(要認証)。
 * URL の一般処理は @platform/url、API 取得の土台は @platform/integrations を参照。
 * @packageDocumentation
 */
export * from "./platforms.js";
export * from "./handle.js";
export * from "./parse.js";
export * from "./embed.js";
export * from "./accounts.js";
export * from "./feed.js";
export * from "./share.js";
