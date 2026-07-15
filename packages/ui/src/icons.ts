/**
 * `@platform/ui/icons` — 汎用アイコン(lucide-react の再エクスポート)。
 *
 * アプリは lucide を直接依存に持たず、基盤経由で一貫したバージョンのアイコンを使う。
 * 名前指定(Font Awesome ライク)で使いたい場合は `Icon` コンポーネントを使う。
 *
 * @example
 * ```tsx
 * import { Home, Search, Settings } from "@platform/ui/icons";
 * <Home className="h-5 w-5" />
 * ```
 * @packageDocumentation
 */
export * from "lucide-react";
