/**
 * `@platform/url` — URL・ドメインの汎用処理。
 * URL の解析/組み立て、クエリパラメータ操作、ドメイン抽出(eTLD+1)、正規化、検証・安全性判定。
 * 記事の URL 構造は @platform/blog(permalink)、低レベルのネットワークは @platform/net を参照。
 * @packageDocumentation
 */
export * from "./parse";
export * from "./domain";
export * from "./query";
export * from "./normalize";
export * from "./validate";
