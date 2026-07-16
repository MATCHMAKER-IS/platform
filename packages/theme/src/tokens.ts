/**
 * デザインテーマ(スキン)の型定義。
 *
 * WordPress のテーマのように、色・フォント・角丸・余白・影などを 1 セットにまとめた
 * 「デザイントークン」を定義する。アプリはスキンを差し替えるだけで見た目を一新できる。
 * 明暗(light/dark)とは直交する概念で、1 つのスキンが light/dark 両方のトークンを持つ。
 * @packageDocumentation
 */

/** 明暗モード。既存の @platform/ui の ResolvedTheme と対応する。 */
export type ThemeMode = "light" | "dark";

/**
 * 1 モード分のデザイントークン。CSS 変数 `--color-bg` などに展開される。
 * 値は CSS で有効な文字列(hex / rgb / フォント名など)。
 */
export interface ThemeTokens {
  /** 背景色(ページ全体)。 */
  bg: string;
  /** 前景色(基本テキスト)。 */
  fg: string;
  /** 補助テキスト(キャプション等)。 */
  muted: string;
  /** カード・パネルの背景。 */
  surface: string;
  /** 枠線の色。 */
  border: string;
  /** ブランド主色(ボタン・リンク・強調)。 */
  primary: string;
  /** 主色の上に載せるテキスト色。 */
  primaryFg: string;
  /** 副次アクセント。 */
  accent: string;
  /** 成功・警告・エラーの状態色。 */
  success: string;
  warning: string;
  danger: string;
}

/** モードに依存しない、スキン共通のデザイン特性。 */
export interface ThemeShape {
  /** 基本フォントファミリ。 */
  fontFamily: string;
  /** 見出しフォント(未指定なら fontFamily を流用)。 */
  headingFontFamily?: string;
  /** 角丸の基準(px)。 */
  radius: number;
  /** 余白の基準(px)。UI の余白計算のベース。 */
  spacing: number;
  /** 影の強さ(0=なし〜3=強い)。CSS box-shadow プリセットの選択に使う。 */
  elevation: 0 | 1 | 2 | 3;
}

/** 1 つのデザインテーマ(スキン)。 */
export interface Theme {
  /** 一意な ID(data-skin 属性・保存キーに使う)。英数字とハイフンのみ。 */
  id: string;
  /** 表示名(管理画面やセレクタに出す)。 */
  name: string;
  /** 説明(任意)。 */
  description?: string;
  /** モードに依存しない特性。 */
  shape: ThemeShape;
  /** light / dark それぞれのトークン。 */
  modes: Record<ThemeMode, ThemeTokens>;
}

/**
 * テーマ ID が妥当かを判定する。
 *
 * **ID は `data-skin` 属性と CSS セレクタに入る**ので、記号や空白を許すと
 * セレクタが壊れる(または任意の CSS を注入される)。
 *
 * @param id 判定する ID
 * @returns 妥当なら true(英数字・ハイフン・アンダースコアのみ、1〜40 文字)
 */
export function isValidThemeId(id: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{0,39}$/i.test(id);
}
