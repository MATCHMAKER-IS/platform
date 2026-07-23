"use client";
/**
 * 名前でアイコンを描く部品。
 *
 * `<Icon name="House" />` のように**文字列で指定**できる。設定値やデータベースに
 * アイコン名を持たせたいとき(メニューの定義など)に必要になる。
 *
 * **名前をベタ書きしない。** lucide は改名が多く(`Home` → `House`、
 * `BarChart3` → `ChartColumn` など)、存在しない名前を書くと**何も表示されない**。
 * 名前が固定なら `import { House } from "@platform/ui/icons"` の方が安全
 * (存在しなければビルドで分かる)。
 *
 * @packageDocumentation
 */
import * as React from "react";
import * as Lucide from "lucide-react";
import type { LucideProps } from "lucide-react";

/**
 * 使えるアイコン名。
 *
 * lucide が公開しているものから、部品として使えるもの(先頭が大文字)だけを対象にする。
 */
export type IconName = string;

/** アイコン名 → 部品。 */
type IconMap = Record<string, React.ComponentType<LucideProps>>;

/**
 * 名前で引ける形にまとめる。
 *
 * **`icons` という名前付き export は v0.469 で無くなった**ため、
 * モジュール全体から取り出す。ここを直接使う代わりに `hasIcon` / `iconNames` を使うこと。
 */
function buildRegistry(): IconMap {
  const mod = Lucide as unknown as Record<string, unknown>;

  // 1) `icons` があればそれを使う(数が多いので、あれば速い)。
  //    ただし版によっては中身が部品ではないことがあるので、部品かどうかを確かめる。
  const bundled = mod.icons as Record<string, unknown> | undefined;
  if (bundled && typeof bundled === "object") {
    const entries = Object.entries(bundled).filter(
      ([, v]) => typeof v === "function" || (typeof v === "object" && v !== null && "$$typeof" in (v as object)),
    );
    if (entries.length > 0) return Object.fromEntries(entries) as IconMap;
  }

  // 2) 無ければ名前付き export から拾う。
  //    lucide は版によって `icons` の有無・中身が変わるため、
  //    **どちらでも動く**ようにしておく(実際に v0.469 で表示されなくなった)。
  return Object.fromEntries(
    Object.entries(mod).filter(
      ([key, value]) =>
        // 部品は大文字始まり。型や補助関数(createLucideIcon など)を除く
        /^[A-Z]/.test(key) &&
        key !== "Icon" &&
        (typeof value === "function" || (typeof value === "object" && value !== null)),
    ),
  ) as IconMap;
}

const REGISTRY: IconMap = buildRegistry();

/** {@link Icon} の props。 */
export interface IconProps extends Omit<LucideProps, "ref"> {
  /** アイコン名(例: "House", "Search", "Settings")。 */
  name: IconName;
}

/**
 * 名前でアイコンを描く。
 *
 * 見つからない場合は**何も描かない**(画面を壊さないため)。
 * 名前が正しいかは `hasIcon()` で先に確かめられる。
 *
 * @param props 名前と大きさ、その他 lucide の props
 * @returns アイコン。名前が見つからなければ null
 *
 * @example
 * ```tsx
 * <Icon name="House" size={20} />
 * <Icon name={item.icon} className="h-5 w-5" />   // 設定値から
 * ```
 */
export function Icon({ name, size = 20, ...props }: IconProps) {
  const Cmp = REGISTRY[name];
  if (!Cmp) return null;
  return <Cmp size={size} {...props} />;
}

/**
 * 使えるアイコン名の一覧(五十音順ではなく英字順)。
 *
 * @returns アイコン名の配列
 */
export function iconNames(): IconName[] {
  return Object.keys(REGISTRY).sort();
}

/**
 * その名前のアイコンがあるか。
 *
 * **改名されたものを画面に出す前に確かめる**ために使う
 * (無い名前を渡しても何も出ないため、気づきにくい)。
 *
 * @param name 確かめる名前
 * @returns あれば true
 */
export function hasIcon(name: string): boolean {
  return name in REGISTRY;
}
