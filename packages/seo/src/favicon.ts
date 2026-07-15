/**
 * ファビコン・アイコン関連の link タグ生成（純関数）。
 * @packageDocumentation
 */
import { escapeAttr } from "./meta.js";

/** ファビコン設定。 */
export interface FaviconConfig {
  /** 標準ファビコン（.ico や .svg）。 */
  icon?: string;
  /** SVG アイコン（対応ブラウザ向け）。 */
  svgIcon?: string;
  /** Apple タッチアイコン（180x180 推奨）。 */
  appleTouchIcon?: string;
  /** 各サイズの PNG アイコン（{ size: "32x32", href }）。 */
  pngIcons?: { size: string; href: string }[];
  /** Web アプリマニフェスト。 */
  manifest?: string;
  /** テーマカラー。 */
  themeColor?: string;
  /** タイル色（Windows）。 */
  maskIconColor?: string;
  /** SVG マスクアイコン（Safari ピン留め）。 */
  maskIcon?: string;
}

/** ファビコン等の link/meta タグ HTML を生成する。 */
export function faviconLinks(config: FaviconConfig): string {
  const tags: string[] = [];
  if (config.icon) tags.push(`<link rel="icon" href="${escapeAttr(config.icon)}">`);
  if (config.svgIcon) tags.push(`<link rel="icon" type="image/svg+xml" href="${escapeAttr(config.svgIcon)}">`);
  for (const png of config.pngIcons ?? []) {
    tags.push(`<link rel="icon" type="image/png" sizes="${escapeAttr(png.size)}" href="${escapeAttr(png.href)}">`);
  }
  if (config.appleTouchIcon) tags.push(`<link rel="apple-touch-icon" href="${escapeAttr(config.appleTouchIcon)}">`);
  if (config.maskIcon) tags.push(`<link rel="mask-icon" href="${escapeAttr(config.maskIcon)}"${config.maskIconColor ? ` color="${escapeAttr(config.maskIconColor)}"` : ""}>`);
  if (config.manifest) tags.push(`<link rel="manifest" href="${escapeAttr(config.manifest)}">`);
  if (config.themeColor) tags.push(`<meta name="theme-color" content="${escapeAttr(config.themeColor)}">`);
  return tags.join("\n");
}

/** Next.js の Metadata.icons 形式に変換する。 */
export function faviconMetadata(config: FaviconConfig): { icon?: (string | { url: string; type?: string; sizes?: string })[]; apple?: string; other?: { rel: string; url: string }[] } {
  const icon: (string | { url: string; type?: string; sizes?: string })[] = [];
  if (config.icon) icon.push(config.icon);
  if (config.svgIcon) icon.push({ url: config.svgIcon, type: "image/svg+xml" });
  for (const png of config.pngIcons ?? []) icon.push({ url: png.href, type: "image/png", sizes: png.size });
  const result: { icon?: typeof icon; apple?: string; other?: { rel: string; url: string }[] } = {};
  if (icon.length > 0) result.icon = icon;
  if (config.appleTouchIcon) result.apple = config.appleTouchIcon;
  if (config.maskIcon) result.other = [{ rel: "mask-icon", url: config.maskIcon }];
  return result;
}
