/**
 * テーマ(スキン)を CSS 変数へ変換し、要素に適用するロジック(React 非依存)。
 * @packageDocumentation
 */
import type { Theme, ThemeMode, ThemeTokens, ThemeShape } from "./tokens.js";

/** トークン名 → CSS 変数名。bg → --color-bg のように展開。 */
const COLOR_VARS: Record<keyof ThemeTokens, string> = {
  bg: "--color-bg",
  fg: "--color-fg",
  muted: "--color-muted",
  surface: "--color-surface",
  border: "--color-border",
  primary: "--color-primary",
  primaryFg: "--color-primary-fg",
  accent: "--color-accent",
  success: "--color-success",
  warning: "--color-warning",
  danger: "--color-danger",
};

/** elevation → box-shadow プリセット。 */
const SHADOWS = ["none", "0 1px 2px rgba(0,0,0,.06)", "0 2px 8px rgba(0,0,0,.10)", "0 8px 24px rgba(0,0,0,.16)"];

/**
 * スキンの 1 モード分を CSS 変数のマップに変換する。
 * 色トークン + shape(半径・余白・フォント・影)をまとめて返す。
 */
export function themeToCssVars(theme: Theme, mode: ThemeMode): Record<string, string> {
  const tokens = theme.modes[mode];
  const shape: ThemeShape = theme.shape;
  const vars: Record<string, string> = {};
  for (const key of Object.keys(COLOR_VARS) as (keyof ThemeTokens)[]) {
    vars[COLOR_VARS[key]] = tokens[key];
  }
  vars["--font-family"] = shape.fontFamily;
  vars["--font-heading"] = shape.headingFontFamily ?? shape.fontFamily;
  vars["--radius"] = `${shape.radius}px`;
  vars["--spacing"] = `${shape.spacing}px`;
  vars["--shadow"] = SHADOWS[shape.elevation] ?? SHADOWS[1] ?? "none";
  return vars;
}

/** CSS 変数マップを `:root{...}` の宣言文字列にする(インラインスタイル用ではなく <style> 用)。 */
export function cssVarsToString(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join(" ");
}

/**
 * セレクタ付きの CSS ブロックを生成する。
 * 既定は `:root`。data-skin / data-theme で上書きしたい場合はセレクタを渡す。
 */
export function themeToCssBlock(theme: Theme, mode: ThemeMode, selector = ":root"): string {
  return `${selector} { ${cssVarsToString(themeToCssVars(theme, mode))} }`;
}

/**
 * 複数スキン × 2 モードのすべての CSS を生成する(スタイルシート丸ごと出力用)。
 * セレクタは `[data-skin="id"][data-theme="mode"]`。全部を 1 枚の <style> に入れておけば、
 * 属性を切り替えるだけで即座に見た目が変わる(再描画・再取得不要)。
 */
export function buildThemeStylesheet(themes: Theme[]): string {
  const blocks: string[] = [];
  for (const theme of themes) {
    for (const mode of ["light", "dark"] as ThemeMode[]) {
      blocks.push(themeToCssBlock(theme, mode, `[data-skin="${theme.id}"][data-theme="${mode}"]`));
    }
  }
  return blocks.join("\n");
}

/** classList/setAttribute を持つ要素(documentElement 等)。 */
interface ThemeableEl {
  setAttribute?: (name: string, value: string) => void;
  style?: { setProperty: (prop: string, value: string) => void };
}

/**
 * 要素にスキンとモードを適用する。
 * - data-skin / data-theme 属性を立てる(スタイルシート方式なら属性だけで切り替わる)
 * - さらにインラインで CSS 変数も直接セット(スタイルシートを注入しない構成でも動くように)
 * SSR で要素が無ければ何もしない。
 */
export function applySkin(theme: Theme, mode: ThemeMode, element?: ThemeableEl): void {
  if (!element) return;
  element.setAttribute?.("data-skin", theme.id);
  element.setAttribute?.("data-theme", mode);
  if (element.style) {
    for (const [prop, value] of Object.entries(themeToCssVars(theme, mode))) {
      element.style.setProperty(prop, value);
    }
  }
}
