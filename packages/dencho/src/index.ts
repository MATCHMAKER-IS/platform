/**
 * `@platform/dencho` — 電子帳簿保存法(電帳法)対応の部品。
 * 真実性の確保(改ざん検知のハッシュチェーン・内部タイムスタンプ)と、
 * 可視性の確保(取引年月日・金額・取引先での検索)、保存期間の管理を提供する。
 * @packageDocumentation
 */
export * from "./hash-chain";
export * from "./search";
export * from "./timestamp";
export * from "./retention";
