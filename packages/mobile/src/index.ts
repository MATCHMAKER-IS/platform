/**
 * `@platform/mobile` — タブレット・スマホ向けの処理。
 * レスポンシブ判定・ネットワーク状態・画面向きの純ロジックと、対応する React フック、
 * 共有・触覚・クリップボード等のブラウザ操作ラッパー(feature detection つき)。
 * @packageDocumentation
 */
export * from "./breakpoints";
export * from "./network";
export * from "./orientation";
export * from "./hooks";
export * from "./actions";
export * from "./barcode";
export * from "./camera";
export * from "./pwa";
export * from "./pwa-offline";
