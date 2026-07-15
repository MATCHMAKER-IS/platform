/**
 * `@platform/mobile` — タブレット・スマホ向けの処理。
 * レスポンシブ判定・ネットワーク状態・画面向きの純ロジックと、対応する React フック、
 * 共有・触覚・クリップボード等のブラウザ操作ラッパー(feature detection つき)。
 * @packageDocumentation
 */
export * from "./breakpoints.js";
export * from "./network.js";
export * from "./orientation.js";
export * from "./hooks.js";
export * from "./actions.js";
export * from "./barcode.js";
export * from "./camera.js";
