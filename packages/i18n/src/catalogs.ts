/**
 * 基盤 UI 共通文言。言語別ファイル(catalogs/ja|en|zh|ko.ts)を束ねる。
 * アプリ固有文言はアプリ側で mergeCatalogs / namespaced する。
 * @packageDocumentation
 */
import type { Catalogs } from "./index.js";
import { ja } from "./catalogs/ja.js";
import { en } from "./catalogs/en.js";
import { zh } from "./catalogs/zh.js";
import { ko } from "./catalogs/ko.js";

export const uiCatalogs: Catalogs = { ja, en, zh, ko };
