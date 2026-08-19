"use client";
/**
 * **画面全体を覆う薄い黒の膜**（オーバーレイ）。
 *
 * 【これは何のためか】
 * **「いま操作できない」ことを、見て分かるようにする**ためです。
 *
 * `Dialog` / `Drawer` は自前で膜を持っているので、**そちらを使うなら不要**です。
 * ここが要るのは、**それ以外で画面を止めたいとき**:
 *
 * | 場面 | なぜ膜が要るか |
 * |---|---|
 * | 保存中・送信中 | **押せると二重送信になる**。「押したのに反応しない」と何度も押される |
 * | 画像の拡大表示 | 背景を暗くしないと、**どこを見ればよいか分からない** |
 * | 自前で組んだパネル | **後ろが押せてしまう**——見えているものは押せると思われる |
 *
 * 【濃さについて】
 * **既定は 40%**（`Dialog` と同じ）。統一しているのは、
 * **濃さが場面ごとに違うと「これは別の仕組みか」と迷わせる**ためです。
 *
 * **60% を超えないでください。** 後ろが見えなくなると、
 * **何の上に出ているのか分からなくなります**——「経費の画面で開いたはずが、
 * 戻ったら別の画面だった」という誤解が起きます。
 *
 * 【必ず知っておくこと】
 *
 * - **これだけでは操作を止められません。** 見た目の膜であって、
 *   **キーボード操作（Tab）は後ろへ抜けます**。本当に止めるなら
 *   `Dialog`（フォーカスを閉じ込める）を使ってください
 * - **読み上げには出しません**（`aria-hidden`）。膜そのものは情報ではないので、
 *   スクリーンリーダーには**中身の方**を読ませます
 *
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/** {@link Overlay} の props。 */
export interface OverlayProps {
  /** 表示するか。 */
  open: boolean;
  /**
   * 膜の濃さ（0〜1。既定 0.4）。
   *
   * **0.6 を超えないこと**——後ろが見えないと、何の上に出ているか分からなくなります。
   */
  opacity?: number;
  /**
   * 膜を押したときの処理。
   *
   * **渡さなければ押せません**（クリックが後ろへ通ります）。
   * **閉じる操作に使うなら、閉じてよい場面かを考えてください**——
   * 入力途中のフォームが、**背景を押しただけで消える**のは事故です。
   */
  onClick?: () => void;
  /**
   * 後ろの内容をぼかすか（既定 false）。
   *
   * **見た目は良くなりますが、古い端末では重くなります**——
   * 拠点の古い PC で使うなら、有効にしない方が無難です。
   */
  blur?: boolean;
  /** 膜の上に出す内容（スピナー・パネルなど）。 */
  children?: React.ReactNode;
  /** 重なり順（既定 40。`Dialog` の 50 より下に置いてある）。 */
  zIndex?: number;
  className?: string;
}

/**
 * 画面全体に薄い黒の膜をかける。
 *
 * @param props 表示・濃さ・押したときの処理
 * @returns 膜（`open` が false なら何も描かない）
 *
 * @example
 * ```tsx
 * // 保存中に操作させない
 * <Overlay open={saving}>
 *   <Spinner />
 *   <p className="mt-2 text-white">保存しています…</p>
 * </Overlay>
 * ```
 *
 * @example
 * ```tsx
 * // 押したら閉じる（**入力途中のフォームでは使わないこと**）
 * <Overlay open={preview !== null} onClick={() => setPreview(null)}>
 *   <img src={preview} alt="" className="max-h-[80vh] max-w-[90vw]" />
 * </Overlay>
 * ```
 */
export function Overlay({
  open, opacity = 0.4, onClick, blur = false, children, zIndex = 40, className,
}: OverlayProps) {
  // **`open` が false なら何も描かない。** `hidden` で隠すだけだと、
  // 中身（画像・重い表）が読み込まれ続ける
  if (!open) return null;

  // **0〜0.6 に収める。** 濃すぎると後ろが見えず、
  // 何の上に出ているか分からなくなる
  const alpha = Math.min(0.6, Math.max(0, opacity));

  return (
    <div
      // **膜そのものは読み上げない。** 情報ではないので、
      // スクリーンリーダーには中身の方を読ませる
      aria-hidden={children === undefined}
      onClick={onClick}
      // **押せるなら、キーボードでも押せること。**
      // マウスでしか閉じられない膜は、キーボードだけで操作する人を閉じ込める。
      // `Escape` も受ける——**膜を閉じる操作として最も期待される**キー
      {...(onClick !== undefined
        ? {
            role: "button" as const,
            tabIndex: 0,
            "aria-label": "閉じる",
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
                // **`Space` は画面を送る既定動作を持つ。** 止めないと後ろが動く
                e.preventDefault();
                onClick();
              }
            },
          }
        : {})}
      className={cn(
        "fixed inset-0 flex flex-col items-center justify-center",
        // **押せるときだけ指の形にする。** 押せないのに指が出ると、
        // 「押しても閉じない」と思われる
        onClick !== undefined && "cursor-pointer",
        blur && "backdrop-blur-sm",
        className,
      )}
      style={{ zIndex, backgroundColor: `rgb(0 0 0 / ${alpha})` }}
    >
      {/* **中身のクリックは膜に伝えない。** 中のボタンを押しただけで
          閉じてしまうのを防ぐ */}
      {children !== undefined && (
        // **中身のクリックは膜に伝えない**——中のボタンを押しただけで閉じるのを防ぐ。
        //
        // **`onClick` は使わない。** 押せない `<div>` に `onClick` を置くと、
        // **キーボードで到達できない操作**に見える(`check-a11y` の指摘どおり)。
        // ここでやりたいのは「伝播を止める」だけなので、
        // **捕捉フェーズで止める** `onClickCapture` を使う——
        // 押せる要素ではないので、`role` も `tabIndex` も要らない
        <div onClickCapture={(e) => { e.stopPropagation(); }}>{children}</div>
      )}
    </div>
  );
}

/** {@link BusyOverlay} の props。 */
export interface BusyOverlayProps {
  /** 処理中か。 */
  busy: boolean;
  /** 表示する文言（既定「処理しています…」）。 */
  label?: string;
  /** 重なり順。 */
  zIndex?: number;
}

/**
 * **処理中に画面を止める**膜（よく使う形）。
 *
 * 【なぜ専用の形を用意するか】
 * **「保存中に何も出さない」が最も多い不具合**です。
 * 押しても見た目が変わらないので、**利用者は何度も押します**——
 * 冪等でない処理なら、そのまま二重登録になります。
 *
 * **文言を必ず出してください。** 膜だけだと「固まった」と思われます。
 *
 * @param props 処理中かどうかと、表示する文言
 * @returns 膜（`busy` が false なら何も描かない）
 *
 * @example
 * ```tsx
 * <BusyOverlay busy={saving} label="保存しています…" />
 * ```
 */
export function BusyOverlay({ busy, label = "処理しています…", zIndex }: BusyOverlayProps) {
  // **ここでも判定する。** `<Overlay open={false}>` に任せても
  // 画面には何も出ませんが、**この関数の戻り値は要素のまま**です
  // ——「busy が false なら何も返さない」という約束が
  // **中身を描くところまで行かないと確かめられません**
  // (実際、関数として呼ぶ試験がここをすり抜けていました。2026-08)。
  // 中身の要素を作る手間も省けます
  if (!busy) return null;

  return (
    <Overlay open={busy} zIndex={zIndex}>
      {/* **読み上げにも伝える。** 目が見えない人にも「待っている」と分かるように */}
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-3">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white"
          aria-hidden="true"
        />
        <p className="text-sm text-white">{label}</p>
      </div>
    </Overlay>
  );
}
