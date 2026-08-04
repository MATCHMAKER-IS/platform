import type { Theme } from "./tokens";
/** 検証の失敗理由。 */
export interface ThemeValidationIssue {
    path: string;
    message: string;
}
/**
 * 未知の値が Theme として妥当か検証し、問題の一覧を返す（空なら妥当）。
 * 例外は投げない。投げてほしい場合は {@link parseTheme} を使う。
 *
 * @param value 検証する値(JSON からパースした直後など)
 * @returns 問題の一覧。**空なら妥当**
 */
export declare function validateTheme(value: unknown): ThemeValidationIssue[];
/**
 * 検証して Theme として返す。
 *
 * **不正なら例外を投げる**。問題を一覧で受け取りたいなら {@link validateTheme}。
 *
 * @param value 検証する値
 * @returns テーマ
 * @throws {@link @platform/core#AppError} コード `VALIDATION` — テーマとして不正な場合
 */
export declare function parseTheme(value: unknown): Theme;
/**
 * テーマを JSON 文字列にする(保存・書き出し用)。
 *
 * @param theme テーマ
 * @returns 整形済みの JSON 文字列
 */
export declare function themeToJson(theme: Theme): string;
/**
 * 複数のテーマを JSON にする(書き出し用)。
 *
 * **`{ version, themes }` の形**にすることで、将来の形式変更に備える。
 *
 * @param themes テーマの配列
 * @returns 整形済みの JSON 文字列
 */
export declare function themesToJson(themes: Theme[]): string;
/**
 * JSON 文字列からテーマを読み込む（単体 or `{version, themes}` の束の両方に対応）。
 *
 * @param json JSON 文字列
 * @returns テーマの配列
 * @throws {@link @platform/core#AppError} コード `VALIDATION` — JSON が不正、またはテーマとして妥当でない場合
 * 不正なテーマは VALIDATION エラー。読み込めたテーマの配列を返す。
 */
export declare function themesFromJson(json: string): Theme[];
//# sourceMappingURL=serialize.d.ts.map