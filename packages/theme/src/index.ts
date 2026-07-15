/**
 * @platform/theme — デザインテーマ(スキン)機構。
 *
 * WordPress のテーマのように、色・フォント・角丸・余白・影を 1 セットにした「スキン」を
 * 切り替えられる。明暗(light/dark)とは直交し、後からテーマを追加できる拡張性を持つ。
 * React 非依存の純ロジック(トークン・CSS 変数・レジストリ)。UI 連携は @platform/ui 側で。
 * @packageDocumentation
 */
export type { Theme, ThemeTokens, ThemeShape, ThemeMode } from "./tokens.js";
export { isValidThemeId } from "./tokens.js";
export { themeToCssVars, cssVarsToString, themeToCssBlock, buildThemeStylesheet, applySkin } from "./css.js";
export { createThemeRegistry, type ThemeRegistry, type CreateThemeRegistryOptions } from "./registry.js";
export { defaultTheme, corporateTheme, softTheme, highContrastTheme, cuteTheme, warmTheme, chicTheme, modernTheme, retroTheme, monochromeTheme, coolTheme, builtInThemes } from "./themes.js";
export { checkThemeContrast, checkTheme, findContrastIssues, type ContrastCheck, type ThemeContrastReport } from "./a11y.js";
export { deriveTheme, type ThemeSeed } from "./derive.js";
export { validateTheme, parseTheme, themeToJson, themesToJson, themesFromJson, type ThemeValidationIssue } from "./serialize.js";
