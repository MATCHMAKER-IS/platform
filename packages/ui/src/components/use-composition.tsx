"use client";
/**
 * IME の変換中かを知るフック。
 *
 * **日本語入力の典型的なバグを防ぐためのもの。**
 * 日本語は IME で「ひらがな → 変換 → 確定」と打つので、キー入力ごとに検証すると
 * **確定前の文字で弾いてしまう**(「やまだ」の時点で「漢字で入力してください」と出る)。
 *
 * `compositionstart` / `compositionend` を見て、**確定後にだけ検証する**。
 * @packageDocumentation
 */
import * as React from "react";

/** {@link useComposition} が返すもの。 */
export interface CompositionState {
  /** IME で変換中か。**true の間は検証しない**。 */
  isComposing: boolean;
  /** `<input>` にそのまま展開する。 */
  handlers: {
    onCompositionStart: () => void;
    onCompositionEnd: () => void;
  };
}

/**
 * IME の変換中かを追う。
 *
 * @remarks
 * **Enter キーにも効く。** 変換確定の Enter と、送信の Enter は同じキーイベントなので、
 * `isComposing` を見ないと**変換を確定した瞬間にフォームが送信される**。
 * これは日本語環境で最も多い UI バグの 1 つ。
 *
 * @returns 変換中フラグと、input に渡すハンドラ
 * @example
 * ```tsx
 * const { isComposing, handlers } = useComposition();
 * <Input
 *   {...handlers}
 *   onChange={(e) => { setValue(e.target.value); if (!isComposing) validate(e.target.value); }}
 *   onKeyDown={(e) => { if (e.key === "Enter" && !isComposing) submit(); }}
 * />
 * ```
 */
export function useComposition(): CompositionState {
  const [isComposing, setIsComposing] = React.useState(false);
  const handlers = React.useMemo(
    () => ({
      onCompositionStart: () => setIsComposing(true),
      onCompositionEnd: () => setIsComposing(false),
    }),
    [],
  );
  return { isComposing, handlers };
}
