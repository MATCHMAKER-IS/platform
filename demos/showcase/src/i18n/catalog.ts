/** 基盤カタログ + アプリのドメイン別カタログ(名前空間付き)を結合。 */
import { mergeCatalogs, namespaced } from "@platform/i18n";
import { uiCatalogs } from "@platform/i18n/catalogs";
import { expensesCatalog } from "./domains/expenses";
import { importsCatalog } from "./domains/imports";

export const catalogs = mergeCatalogs(
  uiCatalogs,
  namespaced("expenses", expensesCatalog),
  namespaced("imports", importsCatalog),
);
