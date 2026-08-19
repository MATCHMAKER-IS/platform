"use client";
/**
 * データを待つ間の表示。
 *
 * 【なぜ要るか】
 * 「読み込み中…」を出したまま**エラーの分岐を書き忘れる**画面が多い。
 * 取得に失敗すると、いつまでも「読み込み中」のままになり、
 * 利用者には**動いているのか壊れているのか分からない**。
 * 2026-08 に 15 画面がこの状態だった。
 *
 * 3 つの状態を 1 か所で扱えば、書き忘れようがない。
 *
 * | 状態 | 出すもの |
 * |---|---|
 * | 読み込み中 | 「読み込み中…」 |
 * | 失敗 | 理由 + 再試行のボタン |
 * | 空 | 「まだありません」(`empty` を渡したとき) |
 * @packageDocumentation
 */
import * as React from "react";
import { Alert } from "./alert";
import { Button } from "./button";
import { EmptyState } from "./empty-state";
import { cn } from "../lib/cn";

/** {@link AsyncBoundary} の props。 */
export interface AsyncBoundaryProps {
  /** 読み込み中か。 */
  loading: boolean;
  /** 失敗の理由。空文字なら失敗していない。 */
  error?: string;
  /** もう一度試す。**渡さないとボタンを出さない**(再試行できない場面もある)。 */
  onRetry?: () => void;
  /** 中身が空か。`true` なら空の表示にする。 */
  isEmpty?: boolean;
  /** 空のときの見出し。 */
  emptyTitle?: string;
  /** 空のときの説明。 */
  emptyDescription?: React.ReactNode;
  /**
   * 中身。
   *
   * **省略できる。** データが `null` の間は、呼び出し側で
   * `if (data === null) return <AsyncBoundary loading … />;` と
   * **早期に返すのが正しい**——`children` を渡すと JSX は先に評価されるので、
   * `data.x` を含む中身は**この部品が判断する前に落ちる**
   * (2026-08 の型検査で 7 画面がこの形だった)。
   */
  children?: React.ReactNode;
  className?: string;
}

/**
 * 読み込み・失敗・空をまとめて扱う。
 *
 * @param loading 読み込み中か
 * @param error 失敗の理由(空文字なら失敗していない)
 * @returns 状態に応じた表示、または `children`
 *
 * @example
 * ```tsx
 * <AsyncBoundary
 *   loading={rows === null}
 *   error={error}
 *   onRetry={() => void load()}
 *   isEmpty={rows?.length === 0}
 *   emptyTitle="まだ登録がありません"
 * >
 *   <Table rows={rows ?? []} />
 * </AsyncBoundary>
 * ```
 */
export function AsyncBoundary({
  loading, error = "", onRetry, isEmpty = false,
  emptyTitle = "まだありません", emptyDescription, children, className,
}: AsyncBoundaryProps) {
  // **失敗を先に見る。**
  // 読み込みを先にすると、再試行中にエラーが隠れて「また待たされている」ように見える
  if (error !== "") {
    return (
      <div className={cn("space-y-3", className)}>
        <Alert variant="danger">{error}</Alert>
        {onRetry !== undefined && (
          <Button variant="secondary" onClick={onRetry}>もう一度試す</Button>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <p className={cn("px-2 py-8 text-center text-sm text-[var(--color-muted)]", className)}>
        読み込み中…
      </p>
    );
  }

  if (isEmpty) {
    return (
      <EmptyState
        title={emptyTitle}
        {...(emptyDescription !== undefined ? { description: emptyDescription } : {})}
        {...(className !== undefined ? { className } : {})}
      />
    );
  }

  return <>{children}</>;
}
