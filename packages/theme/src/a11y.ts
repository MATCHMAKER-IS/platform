/**
 * テーマ(スキン)のアクセシビリティ検査。@platform/color の contrastRatio / wcagLevel を使い、
 * 各モードの主要な色の組み合わせがコントラスト基準(WCAG)を満たすか判定する。
 * 新しいスキンを追加したとき「文字が読みにくくないか」を機械的に確認できる。
 * @packageDocumentation
 */
import { contrastRatio, wcagLevel } from "@platform/color";
import type { Theme, ThemeMode } from "./tokens";

/** 1 つの色ペアの検査結果。 */
export interface ContrastCheck {
  /** 何と何の組み合わせか(例: "本文テキスト / 背景")。 */
  label: string;
  /** 前景・背景の hex。 */
  fg: string;
  bg: string;
  /** コントラスト比。 */
  ratio: number;
  /** WCAG 判定。 */
  level: "AAA" | "AA" | "fail";
}

/** テーマ 1 モード分の検査結果。 */
export interface ThemeContrastReport {
  themeId: string;
  mode: ThemeMode;
  checks: ContrastCheck[];
  /** 1 つでも fail があれば false。 */
  passesAA: boolean;
  /** 最小のコントラスト比(最も危ういペア)。 */
  minRatio: number;
}

/** 検査する色ペア(テキスト系は最低 AA=4.5 が目安)。 */
const PAIRS: { label: string; fg: keyof Theme["modes"]["light"]; bg: keyof Theme["modes"]["light"] }[] = [
  { label: "本文テキスト / 背景", fg: "fg", bg: "bg" },
  { label: "本文テキスト / サーフェス", fg: "fg", bg: "surface" },
  { label: "補助テキスト / 背景", fg: "muted", bg: "bg" },
  { label: "主ボタン文字 / 主色", fg: "primaryFg", bg: "primary" },
];

/**
 * テーマ 1 モードのコントラストを検査する。
 *
 * **テキスト系のペア**(背景と文字・主色と文字など)が基準を満たすかを見る。
 * ここを外すと、**見えるが読めない画面**ができる(薄いグレーの文字など)。
 *
 * @param theme テーマ
 * @param mode 検査するモード(light / dark)
 * @returns 各ペアのコントラスト比と合否
 */
export function checkThemeContrast(theme: Theme, mode: ThemeMode): ThemeContrastReport {
  const tokens = theme.modes[mode];
  const checks: ContrastCheck[] = PAIRS.map((p) => {
    const fg = tokens[p.fg];
    const bg = tokens[p.bg];
    const ratio = contrastRatio(fg, bg);
    return { label: p.label, fg, bg, ratio, level: wcagLevel(ratio) };
  });
  const passesAA = checks.every((c) => c.level !== "fail");
  const minRatio = checks.reduce((m, c) => Math.min(m, c.ratio), Infinity);
  return { themeId: theme.id, mode, checks, passesAA, minRatio: minRatio === Infinity ? 0 : minRatio };
}

/**
 * テーマの light / dark 両方のコントラストを検査する。
 *
 * **片方だけ見ても意味がない**。ダークモードで文字が読めなくなるのは、
 * light だけ確認して見落とす典型。
 *
 * @param theme テーマ
 * @param level 達成基準(既定 AA)
 * @returns light / dark それぞれの検査結果
 */
export function checkTheme(theme: Theme): ThemeContrastReport[] {
  return [checkThemeContrast(theme, "light"), checkThemeContrast(theme, "dark")];
}

/**
 * 複数テーマをまとめて検査し、AA を満たさないものだけ抜き出す。
 * CI や smoke で「壊れたスキン」を検出するのに使う。
 *
 * **人の目視では見落とす**(11 スキン × light/dark で 22 通り)。機械に任せる。
 *
 * @param themes テーマの配列
 * @returns 基準を満たさないテーマの検査結果。**問題が無ければ空配列**
 */
export function findContrastIssues(themes: Theme[]): ThemeContrastReport[] {
  const issues: ThemeContrastReport[] = [];
  for (const theme of themes) {
    for (const report of checkTheme(theme)) {
      if (!report.passesAA) issues.push(report);
    }
  }
  return issues;
}
