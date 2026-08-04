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
export declare function checkThemeContrast(theme: Theme, mode: ThemeMode): ThemeContrastReport;
/**
 * テーマの light / dark 両方のコントラストを検査する。
 *
 * **片方だけ見ても意味がない**。ダークモードで文字が読めなくなるのは、
 * light だけ確認して見落とす典型。
 *
 * @param theme テーマ
 * @returns light / dark それぞれの検査結果
 */
export declare function checkTheme(theme: Theme): ThemeContrastReport[];
/**
 * 複数テーマをまとめて検査し、AA を満たさないものだけ抜き出す。
 * CI や smoke で「壊れたスキン」を検出するのに使う。
 *
 * **人の目視では見落とす**(11 スキン × light/dark で 22 通り)。機械に任せる。
 *
 * @param themes テーマの配列
 * @returns 基準を満たさないテーマの検査結果。**問題が無ければ空配列**
 */
export declare function findContrastIssues(themes: Theme[]): ThemeContrastReport[];
//# sourceMappingURL=a11y.d.ts.map