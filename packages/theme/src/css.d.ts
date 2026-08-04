/**
 * テーマ(スキン)を CSS 変数へ変換し、要素に適用するロジック(React 非依存)。
 * @packageDocumentation
 */
import type { Theme, ThemeMode } from "./tokens";
/**
 * スキンの 1 モード分を CSS 変数のマップに変換する。
 *
 * 色トークン + shape(半径・余白・フォント・影)をまとめて返す。
 * **アプリは色を直書きせず、この変数を参照する**ことでテーマ切り替えに追従できる。
 *
 * @param theme テーマ
 * @param mode モード(light / dark)
 * @returns CSS 変数名 → 値 のマップ(`--color-primary` など)
 */
export declare function themeToCssVars(theme: Theme, mode: ThemeMode): Record<string, string>;
/**
 * CSS 変数のマップを宣言文字列にする。
 *
 * **`<style>` 用**(インラインスタイル用ではない)。
 *
 * @param vars CSS 変数のマップ
 * @returns `:root{--color-primary:#fff;...}` 形式
 */
export declare function cssVarsToString(vars: Record<string, string>): string;
/**
 * セレクタ付きの CSS ブロックを生成する。
 * 既定は `:root`。data-skin / data-theme で上書きしたい場合はセレクタを渡す。
 *
 * @param theme スキンの 1 モード
 * @param mode 形の設定
 * @param selector セレクタ(既定 `:root`)
 * @returns CSS ブロックの文字列
 */
export declare function themeToCssBlock(theme: Theme, mode: ThemeMode, selector?: string): string;
/**
 * 複数スキン × 2 モードのすべての CSS を生成する(スタイルシート丸ごと出力用)。
 * セレクタは `[data-skin="id"][data-theme="mode"]`。全部を 1 枚の <style> に入れておけば、
 * 属性を切り替えるだけで即座に見た目が変わる(再描画・再取得不要)。
 *
 * @param themes テーマの配列
 * @returns すべてのスキン・モードを含む CSS 文字列
 */
export declare function buildThemeStylesheet(themes: Theme[]): string;
/** classList/setAttribute を持つ要素(documentElement 等)。 */
interface ThemeableEl {
    setAttribute?: (name: string, value: string) => void;
    style?: {
        setProperty: (prop: string, value: string) => void;
    };
}
/**
 * 要素にスキンとモードを適用する。
 * - data-skin / data-theme 属性を立てる(スタイルシート方式なら属性だけで切り替わる)
 * - さらにインラインで CSS 変数も直接セット(スタイルシートを注入しない構成でも動くように)
 * SSR で要素が無ければ何もしない。
 *
 * @param theme テーマ
 * @param mode モード(light / dark)
 * @param element 適用先(省略時は `document.documentElement`)
 * @returns なし(要素の属性とスタイルを書き換える副作用のみ)
 */
export declare function applySkin(theme: Theme, mode: ThemeMode, element?: ThemeableEl): void;
export {};
//# sourceMappingURL=css.d.ts.map