import type { Theme, ThemeShape } from "./tokens";
/** deriveTheme に渡す最小限の入力。 */
export interface ThemeSeed {
    /** スキン id(英数字・ハイフン)。 */
    id: string;
    /** 表示名。 */
    name: string;
    /** 説明(任意)。 */
    description?: string;
    /** ブランド主色(必須)。 */
    primary: string;
    /** アクセント色(省略時は主色から生成)。 */
    accent?: string;
    /** ベースの明るさ("light" は白基調 / "warm" はややクリーム / "cool" はやや青み)。既定 "light"。 */
    base?: "light" | "warm" | "cool";
    /** 形状(角丸・フォント等)。省略時は標準値。 */
    shape?: Partial<ThemeShape>;
}
/**
 * ブランド色から light/dark 両モードのトークンを組み立てる。
 * - primaryFg は主色に対して読みやすい黒/白を自動選択
 * - 背景・サーフェス・枠線・補助テキストは base 系統から派生
 *
 * **1 色決めれば全部できる**のが要点。11 個のトークンを手で選ぶと、
 * 必ずどこかでコントラストを外す(そして気づかない)。
 *
 * @param seed ブランド色と、任意の調整値
 * @returns light / dark 両モードのテーマ
 */
export declare function deriveTheme(seed: ThemeSeed): Theme;
//# sourceMappingURL=derive.d.ts.map