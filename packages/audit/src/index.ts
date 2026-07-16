/**
 * `@platform/audit` — 監査ログ(操作履歴)。追記専用 + ハッシュチェーンで改ざん検知、差分抽出、検索。
 * ブループリント遷移・承認・仕訳などの業務イベントを「誰が・いつ・何を・どう変えたか」で記録する。
 * @packageDocumentation
 */
export * from "./event";
export * from "./log";
export * from "./query";
