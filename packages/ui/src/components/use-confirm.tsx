"use client";

import * as React from "react";
import { ConfirmDialog } from "./confirm-dialog";

/**
 * **消す前に一度だけ確かめる**ためのフック。
 *
 * 【なぜ要るか】
 * 一覧に並んだ「削除」ボタンは、**隣の行を消すつもりで押し間違える**。
 * 業務データは元に戻せないことが多く、
 * 「お知らせを消したら誰も気づかないまま公開が止まっていた」
 * 「予約を消したら来店した人が現れた」という形で後から分かる。
 *
 * 2026-08 に、画面からの削除 13 箇所のうち **11 箇所が確認なし**だった。
 * 個別に `ConfirmDialog` を書くと**書き忘れる**ので、
 * **1 行で使える形**にまとめた。
 *
 * 【使い方】
 * ```tsx
 * const { confirm, dialog } = useConfirm();
 *
 * <Button onClick={() => confirm({
 *   title: "このお知らせを削除しますか",
 *   description: "元に戻せません。公開中なら、すぐにサイトから消えます。",
 *   onConfirm: () => void remove(a.id),
 * })}>削除</Button>
 *
 * {dialog}
 * ```
 *
 * 【`window.confirm` を使わない理由】
 * 見た目がブラウザ任せで**アプリの外に見える**うえ、
 * **タブ全体が固まる**(他の操作ができない)。
 * 文面も 1 行しか出せないので、「何が起きるか」を書けない。
 *
 * @packageDocumentation
 */

/** {@link useConfirm} の `confirm` に渡す内容。 */
export interface ConfirmRequest {
  /** 見出し(例: 「このお知らせを削除しますか」)。 */
  title: string;
  /**
   * 何が起きるかの説明。
   *
   * **「元に戻せません」だけでは足りない。** 何が起きるかを書くこと
   * ——「公開中なら、すぐにサイトから消えます」のように、
   * **押した後の世界**が想像できる文にする。
   */
  description?: string;
  /** 確定したときの処理。 */
  onConfirm: () => void;
  /** 確定ボタンの文言(既定「削除する」)。 */
  confirmText?: string;
  /**
   * 取り返しがつく操作か(既定 `false` = 取り返しがつかない)。
   *
   * `true` にすると確定ボタンが赤くなくなる。
   * **迷うなら既定のまま**——赤い方が一拍おいて読む。
   */
  reversible?: boolean;
}

/**
 * 確認ダイアログを 1 行で出せるようにする。
 *
 * @returns `confirm`(確認を求める)と `dialog`(画面に置く要素)
 */
export function useConfirm(): {
  confirm: (request: ConfirmRequest) => void;
  dialog: React.ReactNode;
} {
  const [request, setRequest] = React.useState<ConfirmRequest | null>(null);

  const confirm = React.useCallback((r: ConfirmRequest) => {
    setRequest(r);
  }, []);

  const dialog = (
    <ConfirmDialog
      open={request !== null}
      onOpenChange={(open) => {
        // **閉じたら忘れる。** 残したままだと、次に開いたとき
        // **前回の対象を消してしまう**
        if (!open) setRequest(null);
      }}
      title={request?.title ?? ""}
      description={request?.description}
      confirmText={request?.confirmText ?? "削除する"}
      destructive={request?.reversible !== true}
      onConfirm={() => {
        const r = request;
        setRequest(null);
        r?.onConfirm();
      }}
    />
  );

  return { confirm, dialog };
}
