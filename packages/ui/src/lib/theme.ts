/**
 * テーマ(ダーク/ライト)の解決ロジック(純ロジック・React 非依存)。
 * ユーザーの選好(light/dark/system)と OS 設定から実際の見た目を決める。
 * @packageDocumentation
 */

/** ユーザーが選べるテーマ。system は OS 設定に従う。 */
export type ThemePreference = "light" | "dark" | "system";

/** 実際に適用される見た目。 */
export type ResolvedTheme = "light" | "dark";

/**
 * 選好と OS 設定から実際のテーマを解決する。
 *
 * **`system` を選んだ人は OS に追従する**(OS をダークにしたらアプリもダークに)。
 *
 * @param preference 利用者の選好(`light` / `dark` / `system`)
 * @param systemPrefersDark OS がダークか
 * @returns 実際に適用するテーマ(`light` / `dark`)
 */
export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

/**
 * 選好を循環させる(light → dark → system → light)。
 *
 * **3 状態のトグル**。`system` を選べることが重要(OS に合わせたい人が多い)。
 *
 * @param current 現在の選好
 * @returns 次の選好
 */
export function nextThemePreference(current: ThemePreference): ThemePreference {
  return current === "light" ? "dark" : current === "dark" ? "system" : "light";
}

/**
 * 明暗を反転する(2 状態のトグル用)。
 *
 * **`system` を選べない**ので、OS 追従が要るなら {@link cycleThemePreference} を使う。
 *
 * @param current 現在のテーマ
 * @returns 反転したテーマ
 */
export function toggleTheme(resolved: ResolvedTheme): ResolvedTheme {
  return resolved === "light" ? "dark" : "light";
}

/** 選好の日本語ラベル。 */
export const THEME_LABELS: Record<ThemePreference, string> = {
  light: "ライト",
  dark: "ダーク",
  system: "システム",
};

/** classList を持つ要素(documentElement 等)。 */
interface ClassListEl {
  classList: { add: (c: string) => void; remove: (c: string) => void };
  setAttribute?: (name: string, value: string) => void;
}

/**
 * 要素に解決済みテーマを適用する(Tailwind の dark クラス + data-theme 属性)。
 * SSR では要素を渡さなければ何もしない。
 * @param theme 適用するテーマ
 * @param element 適用先(省略時は documentElement)
 */
export function applyTheme(resolved: ResolvedTheme, element?: ClassListEl): void {
  if (!element) return;
  if (resolved === "dark") element.classList.add("dark");
  else element.classList.remove("dark");
  element.setAttribute?.("data-theme", resolved);
}

/** テーマ選好を保存する localStorage の既定キー。 */
export const THEME_STORAGE_KEY = "theme";

/**
 * 描画前(<head>)にインラインで実行し、テーマを即適用してちらつき(FOUC)を防ぐスクリプトを返す。
 * localStorage の選好と OS 設定から dark クラス/属性を先に付ける。
 * Next.js なら <script dangerouslySetInnerHTML={{ __html: themeInitScript() }} /> を <head> に。
 *
 * @param storageKey 保存キー
 * @returns `<script>` に入れる文字列。**`<head>` で同期実行する**(でないと、一瞬明るい画面が出てから暗くなる = FOUC)
 */
export function themeInitScript(storageKey: string = THEME_STORAGE_KEY): string {
  return `(function(){try{var k=${JSON.stringify(storageKey)};var p=localStorage.getItem(k)||"system";var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var e=document.documentElement;if(d){e.classList.add("dark");}else{e.classList.remove("dark");}e.setAttribute("data-theme",d?"dark":"light");}catch(_){}})();`;
}

