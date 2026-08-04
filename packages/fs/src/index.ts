/**
 * `@platform/fs` — ファイル/フォルダ操作とパスユーティリティ。
 *
 * **このバレルは `node:fs` を引き込む**ので、ブラウザ("use client")からは import できない
 * (Turbopack が解決できずビルドが落ちる)。
 * 中身の判定(`detectFileType` 等)はバイト列を見るだけで node に依存しないため、
 * **`@platform/fs/magic` から個別に import する**。
 *
 * @packageDocumentation
 */
export * from "./path";
export * from "./operations";

export * from "./magic";
