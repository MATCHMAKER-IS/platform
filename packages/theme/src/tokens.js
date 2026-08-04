/**
 * デザインテーマ(スキン)の型定義。
 *
 * WordPress のテーマのように、色・フォント・角丸・余白・影などを 1 セットにまとめた
 * 「デザイントークン」を定義する。アプリはスキンを差し替えるだけで見た目を一新できる。
 * 明暗(light/dark)とは直交する概念で、1 つのスキンが light/dark 両方のトークンを持つ。
 * @packageDocumentation
 */
/**
 * テーマ ID が妥当かを判定する。
 *
 * **ID は `data-skin` 属性と CSS セレクタに入る**ので、記号や空白を許すと
 * セレクタが壊れる(または任意の CSS を注入される)。
 *
 * @param id 判定する ID
 * @returns 妥当なら true(英数字・ハイフン・アンダースコアのみ、1〜40 文字)
 */
export function isValidThemeId(id) {
    return /^[a-z0-9][a-z0-9_-]{0,39}$/i.test(id);
}
//# sourceMappingURL=tokens.js.map