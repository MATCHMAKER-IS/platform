/**
 * 共通 Textarea。Input と同じトークンで見た目を揃える。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/** {@link Textarea} の props。 */
export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

/**
 * 複数行の入力欄。
 *
 * 1 行で足りる項目には `Input` を使う。Textarea にすると
 * 「たくさん書いてよい」という合図になり、入力の負担が増える。
 *
 * - `rows` で初期の高さを決める(既定は 3 行程度)。長文が前提なら 6〜10
 * - 文字数の上限があるなら `maxLength` を必ず付ける(送信してから怒られるのを防ぐ)
 * - 改行を含む値は CSV に出すとき壊れやすい。`@platform/csv` の `toCsv` を使う
 *
 * @example
 * ```tsx
 * <Textarea rows={6} maxLength={2000} placeholder="申請の理由を書いてください"
 *   value={reason} onChange={(e) => setReason(e.target.value)} />
 * ```
 */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-[80px] w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
