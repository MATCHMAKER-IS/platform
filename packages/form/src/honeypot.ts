/**
 * ハニーポット（ボット除け）の判定。
 *
 * 【なぜ独立したファイルにしているか】
 * 判定そのものは**サーバ側で行います**——画面で弾いてもボットは
 * API を直接叩くので、**サーバで見なければ意味がありません**。
 *
 * ところがこの関数は 2026-08 まで `form-helpers.tsx`（`"use client"` 付き・
 * `react-hook-form` を import）に置かれていました。**サーバのルートが
 * それを取り込むと、クライアント専用のライブラリごと巻き込みます**
 * ——`public-site` の問い合わせ API が実際にそうなっていて、
 * `next build` が `'useForm' is not exported from 'react-hook-form'` を出しました。
 *
 * **依存を持たないので、どこからでも呼べます**（Edge でも Node でも）。
 *
 * @packageDocumentation
 */

/**
 * ハニーポットが埋められていれば true（＝ボットの可能性）。
 *
 * **人には見えない入力欄**（`HoneypotField`）に値が入っていたら、
 * 自動入力したものと見なします。
 *
 * **これだけで防ぎ切れるとは考えないでください。** 賢いボットは
 * 隠し欄を避けます。速度制限（`@platform/ratelimit`）と併せて使うものです。
 *
 * @param value 隠し欄に入っていた値
 * @returns 埋められていれば true
 */
export function isHoneypotFilled(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}
