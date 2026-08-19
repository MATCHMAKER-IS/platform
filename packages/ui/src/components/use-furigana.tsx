"use client";
/**
 * 漢字を入力すると**ふりがな欄が自動で埋まる**フック。
 *
 * 【なぜ基盤に要るか】
 * 日本の申込フォーム・社員登録・顧客登録では、氏名とふりがなの両方を求める。
 * 利用者に二度打たせるのは負担が大きく、**打ち直しの分だけ表記が揺れる**
 * (「山田太郎」と「ヤマダ タロウ」で姓名の区切りが合わない等)。
 *
 * 変換前の読みは `compositionupdate` の `data` で取れる。
 * これを拾って溜めれば、**確定した漢字に対応する読みが手に入る**。
 * ブラウザだけで完結し、外部の形態素解析も辞書も要らない。
 *
 * 【限界を先に書く】
 * - **変換なしで入力した漢字は拾えない。** コピー&ペーストや
 *   予測変換からの確定では `compositionupdate` が出ないことがある
 * - **読みは IME が出したものそのまま。** 「日下部」を「くさかべ」と
 *   打てばそう入る。人名の正しい読みを当てる機能ではない
 * - だから**ふりがな欄は編集可能にする**こと。自動で埋めた後、
 *   利用者が直せなければ、間違った読みが登録される
 *
 * @packageDocumentation
 */
import * as React from "react";
import { toKatakana, toHiragana } from "@platform/utils";

/** ふりがなの種類。 */
export type KanaKind =
  /** カタカナ(「ヤマダ タロウ」)。**帳票・銀行口座はこちら**が多い。 */
  | "katakana"
  /** ひらがな(「やまだ たろう」)。学校・医療の書式で使われる。 */
  | "hiragana";

/** {@link useFurigana} の戻り値。 */
export interface FuriganaState {
  /** 氏名の入力欄に渡すハンドラ(`onChange` とは別に付ける)。 */
  nameHandlers: {
    onCompositionUpdate: (e: React.CompositionEvent<HTMLInputElement>) => void;
    onCompositionEnd: (e: React.CompositionEvent<HTMLInputElement>) => void;
  };
  /** 自動で埋まったふりがな。**利用者が直せるようにすること**。 */
  kana: string;
  /** ふりがなを手で直すときに呼ぶ。 */
  setKana: (value: string) => void;
}

/**
 * 氏名の入力から、ふりがなを自動で埋める。
 *
 * **ふりがな欄は必ず編集可能にすること。** IME が出した読みをそのまま使うので、
 * 人名では外れることがある(「日下部」を「ひのしたぶ」と打てばそう入る)。
 * 直せない画面にすると、間違った読みが登録されたまま残る。
 *
 * @param kind ふりがなの種類(既定はカタカナ。帳票・銀行口座で使う形)
 * @returns 入力欄に渡すハンドラと、ふりがなの値
 *
 * @example
 * ```tsx
 * const { nameHandlers, kana, setKana } = useFurigana();
 * <Input value={name} onChange={(e) => setName(e.target.value)} {...nameHandlers} />
 * <Input value={kana} onChange={(e) => setKana(e.target.value)} />
 * ```
 */
export function useFurigana(kind: KanaKind = "katakana"): FuriganaState {
  const [kana, setKana] = React.useState("");
  // 変換中に流れてくる読みを溜める。確定時にまとめて反映する
  const buffer = React.useRef("");

  const nameHandlers = React.useMemo(
    () => ({
      onCompositionUpdate: (e: React.CompositionEvent<HTMLInputElement>) => {
        // **`data` は変換中の読み**(「やまだ」)。確定後の漢字ではない
        buffer.current = e.data;
      },
      onCompositionEnd: (e: React.CompositionEvent<HTMLInputElement>) => {
        const reading = buffer.current;
        buffer.current = "";
        // **読みが取れなかったときは何もしない。** 空で上書きすると、
        // 利用者が手で直した内容を消してしまう
        if (reading === "") return;
        // 確定した文字列が読みと同じなら(かなを直接打った場合)、二重に足さない
        const settled = e.data;
        const piece = kind === "katakana" ? toKatakana(reading) : toHiragana(reading);
        setKana((prev) => (settled === reading ? prev : prev + piece));
      },
    }),
    [kind],
  );

  return { nameHandlers, kana, setKana };
}
