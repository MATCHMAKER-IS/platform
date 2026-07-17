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

/**
 * 利用可能なアイコン名の一覧を返す(PascalCase・アルファベット順)。
 *
 * @remarks
 * **アプリが lucide-react を直接依存に持たなくて済むようにするための窓口。**
 * `.npmrc` が巻き上げを抑えているので、アプリから `import { icons } from "lucide-react"`
 * とは書けない(書くと Module not found)。一覧が要る場面はここを通す。
 *
 * @returns アイコン名の配列
 * @example
 * ```ts
 * iconNames().length            // 1500 以上
 * iconNames().includes("Home")  // lucide のバージョン差を吸収したいときに
 * ```
 */
export function iconNames(): IconName[] {
  return Object.keys(icons).sort() as IconName[];
}

/**
 * その名前のアイコンが実在するかを返す。
 *
 * @remarks
 * **lucide は改名が多い**(`Home`→`House`、`AlertCircle`→`CircleAlert` など)。
 * {@link Icon} は存在しない名前を渡すと **黙って null を返す**ので、
 * 一覧を組むときは事前にこれで絞ると、画面に穴が空かない。
 *
 * @param name 確認したい名前
 * @returns 実在すれば true
 */
export function hasIcon(name: string): name is IconName {
  return name in icons;
}
