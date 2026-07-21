/**
 * 入力の種類 → スマホのキーボード指定(`inputMode`)と関連属性。
 *
 * **CSS の `ime-mode` は使わない。** 標準から削除済みで、Edge の通常モードでは動かず、
 * 「いつ動かなくなってもおかしくない」状態にある。**IME は制御できない**と考えるのが正しい。
 *
 * できるのは以下の 2 つだけ:
 *   1. `inputMode` で **キーボードの種類をヒントとして渡す**(スマホで効く)
 *   2. 入力された全角を **コード側で正規化する**(`@platform/validation` の `toHalfWidth` 等)
 *
 * 「日本語固定」「英数固定」は**ブラウザには指示できない**。
 * 利用者が全角で打ってくる前提で受け止め、正規化するのが唯一の正解。
 * @packageDocumentation
 */

/** 入力の種類。業務フォームで実際に使うものだけを並べる。 */
export type InputKind =
  | "text"
  | "digits"
  | "tel"
  | "email"
  | "url"
  | "search"
  | "decimal"
  | "kana";

/** {@link inputAttrs} が返す属性。そのまま `<Input {...attrs} />` に展開できる。 */
export interface InputKindAttrs {
  inputMode: "text" | "numeric" | "tel" | "email" | "url" | "search" | "decimal";
  /** ブラウザの自動補完。適切に指定すると入力が一気に楽になる。 */
  autoComplete?: string;
  /** 先頭を大文字にしない(メール・URL で邪魔になる)。 */
  autoCapitalize?: "none" | "sentences";
  /** 自動修正を切る(固有名詞・型番で邪魔になる)。 */
  autoCorrect?: "on" | "off";
  /** 半角数字だけを想定する場合のヒント(スマホでテンキーが出やすくなる)。 */
  pattern?: string;
}

const TABLE: Record<InputKind, InputKindAttrs> = {
  // 通常の文字。IME は利用者に任せる(制御できない)。
  text: { inputMode: "text" },
  // 半角数字のみ。**type="number" は使わない**(スピナーが出る、先頭 0 が消える、
  // 全角を弾いてしまう)。text + inputMode=numeric が定石。
  digits: { inputMode: "numeric", pattern: "[0-9]*", autoComplete: "off", autoCorrect: "off" },
  tel: { inputMode: "tel", autoComplete: "tel", autoCorrect: "off" },
  email: { inputMode: "email", autoComplete: "email", autoCapitalize: "none", autoCorrect: "off" },
  url: { inputMode: "url", autoComplete: "url", autoCapitalize: "none", autoCorrect: "off" },
  search: { inputMode: "search", autoCorrect: "off" },
  // 小数を含む数値(金額・数量)。
  decimal: { inputMode: "decimal", autoComplete: "off", autoCorrect: "off" },
  // カナ。**IME をカナに固定はできない**ので、キーボードは text のまま。
  // 全角カナで打ってもらう前提で、検証は @platform/validation の katakana を使う。
  kana: { inputMode: "text", autoCorrect: "off" },
};

/**
 * 入力の種類から、`<input>` に渡す属性を返す。
 *
 * @remarks
 * **スマホでキーボードが変わる**のが主な効果。PC では見た目は変わらない。
 *
 * `digits` で `type="number"` を使わないのは意図的:
 * スピナーが出る / 先頭の 0 が消える / 全角数字を弾いて「なぜか入力できない」になる、
 * という実害があるため。`text` + `inputMode="numeric"` が定石。
 *
 * @param kind 入力の種類
 * @returns `<Input {...inputAttrs("digits")} />` の形で展開できる属性
 * @example
 * ```tsx
 * <Input {...inputAttrs("tel")} value={tel} onChange={...} />   // スマホで電話キーボード
 * <Input {...inputAttrs("digits")} value={zip} onChange={...} /> // テンキー
 * ```
 */
export function inputAttrs(kind: InputKind): InputKindAttrs {
  return TABLE[kind];
}

/** 入力の種類の説明(画面に出す用)。 */
export const INPUT_KIND_LABELS: Record<InputKind, string> = {
  text: "通常（IME は利用者に任せる）",
  digits: "半角数字（テンキー）",
  tel: "電話番号（電話キーボード）",
  email: "メール（@ が出る）",
  url: "URL（/ や .com が出る）",
  search: "検索（改行キーが「検索」に）",
  decimal: "小数を含む数値",
  kana: "カナ（IME は固定できない）",
};
