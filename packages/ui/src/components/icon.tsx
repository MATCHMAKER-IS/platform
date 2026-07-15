/**
 * 共通 Icon。名前(文字列)でアイコンを指定できる汎用コンポーネント。
 * Font Awesome の `<i class="fa fa-home">` のような使い勝手。内部は lucide-react。
 * @packageDocumentation
 */
import * as React from "react";
import { icons, type LucideProps } from "lucide-react";

/** 利用可能なアイコン名(lucide の全アイコン、PascalCase)。 */
export type IconName = keyof typeof icons;

/** {@link Icon} の props。 */
export interface IconProps extends Omit<LucideProps, "ref"> {
  /** アイコン名(例: "Home", "Search", "Settings")。 */
  name: IconName;
}

/**
 * 名前指定でアイコンを描画する。色は既定で currentColor(親のテキスト色を継承)。
 *
 * @remarks
 * 名前指定は全アイコンをバンドルに含めます。バンドルサイズを絞りたい箇所では
 * `@platform/ui/icons` から個別 import(`import { Home } from "@platform/ui/icons"`)を推奨。
 *
 * @example
 * ```tsx
 * <Icon name="Home" size={20} />
 * <Icon name="Trash2" className="text-red-500" />
 * ```
 */
export function Icon({ name, size = 20, ...props }: IconProps) {
  const Cmp = icons[name];
  if (!Cmp) return null;
  return <Cmp size={size} {...props} />;
}
