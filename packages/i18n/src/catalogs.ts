/**
 * 基盤 UI 共通文言。言語別ファイル(catalogs/ja|en|zh|ko.ts)を束ねる。
 * アプリ固有文言はアプリ側で mergeCatalogs / namespaced する。
 * @packageDocumentation
 */
import type { Catalogs } from "./index";
import { ja } from "./catalogs/ja";
import { en } from "./catalogs/en";
import { zh } from "./catalogs/zh";
import { ko } from "./catalogs/ko";

export const uiCatalogs: Catalogs = { ja, en, zh, ko };
