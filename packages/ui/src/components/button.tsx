/**
 * 共通 Button。バリアント(primary/secondary/ghost/danger)とサイズを持つ。
 * shadcn/ui の慣習に沿って cva でスタイルを管理する。
 * @packageDocumentation
 */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-[var(--radius)] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary: "bg-[var(--color-primary)] text-[var(--color-primary-fg)] hover:opacity-90",
        secondary: "border border-[var(--color-border)] text-[var(--color-fg)] hover:bg-[var(--color-subtle)]",
        ghost: "text-[var(--color-fg)] hover:bg-[var(--color-subtle-strong)]",
        danger: "bg-[var(--color-danger)] text-white hover:opacity-90",
        /**
         * タブ・絞り込みの切り替え。**下線で選択を示し、背景は敷かない。**
         *
         * 既定(primary)のまま `text-[var(--color-muted)]` を重ねると、
         * **青地にグレー文字**になって読めない。23 画面がこの形だった(2026-08)。
         * 選択状態は `data-state="active"` で表し、見た目はここで一括して決める。
         */
        tab: [
          "border-b-2 border-transparent bg-transparent text-[var(--color-muted)]",
          "hover:text-[var(--color-fg)] hover:bg-[var(--color-subtle)]",
          // **選択中は下線・文字色・太さで示す。** 色だけに頼らない(色覚特性への配慮)。
          // 記法は checkbox / switch と揃える(data-[state=...])
          "data-[state=active]:border-[var(--color-primary)]",
          "data-[state=active]:text-[var(--color-fg)] data-[state=active]:font-semibold",
        ].join(" "),
        /**
         * 複数選択のトグル(ロール・権限・タグの絞り込み)。
         *
         * タブと違い**同時に複数が選ばれる**ので、下線ではなく
         * 「枠と塗り」で示す。既定(primary)のままだと、選択の有無に関わらず
         * 全部が青く塗られて**どれを選んだか分からない**(2026-08 の状態)。
         */
        toggle: [
          "border border-[var(--color-border)] bg-transparent text-[var(--color-fg)]",
          "hover:bg-[var(--color-subtle)]",
          // 選択中は塗る。**枠も太くする**(色だけに頼らない)
          "data-[state=on]:border-[var(--color-primary)] data-[state=on]:bg-[var(--color-primary)]",
          "data-[state=on]:text-[var(--color-primary-fg)] data-[state=on]:font-semibold",
        ].join(" "),
        /**
         * 星評価。**背景を敷かず、記号の色だけで示す。**
         *
         * 既定(primary)のままだと青い箱の中に星が入り、
         * 何個選んだのかが読み取れない(2026-08 の状態)。
         * 星は**それ自体が図形**なので、囲みは邪魔になる。
         */
        star: [
          "border-0 bg-transparent p-0 text-xl leading-none",
          "text-[var(--color-border)] hover:text-[var(--color-warning)]",
          "data-[state=on]:text-[var(--color-warning)]",
        ].join(" "),
      },
      // 高さは**最小値**にする。固定(h-*)にすると、中身が増えたときに
      // はみ出した部分が見えなくなる(アイコン + 名前を縦に並べた画面で実際に起きた)。
      // 文字だけのボタンでは見た目は変わらない。
      size: {
        sm: "min-h-7 py-1 px-2.5 text-xs",
        md: "min-h-9 py-1.5 px-3.5 text-sm",
        lg: "min-h-10 py-2 px-5 text-sm",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

/** {@link Button} の props。 */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * 処理中か。
   *
   * **押した後に反応が見えないと、二重に押される。**
   * 「保存」を 2 回押して 2 件登録される、が実際に起きる。
   * `true` の間は押せなくなり、`loadingLabel` があればそれを出す。
   */
  loading?: boolean;
  /**
   * 処理中に出す文字(既定は元の中身のまま)。
   *
   * **幅が変わらない方がよい**場面もあるので、必須にしない。
   */
  loadingLabel?: React.ReactNode;
}

/**
 * 共通ボタン。
 * @example
 * ```tsx
 * <Button variant="primary" onClick={save}>保存する</Button>
 * ```
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading = false, loadingLabel, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      // **処理中は押せなくする。** ここで止めないと二重送信になる
      disabled={disabled === true || loading}
      // 読み上げにも「処理中」と伝える(見た目だけでは分からない)
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && loadingLabel !== undefined ? loadingLabel : children}
    </button>
  ),
);
Button.displayName = "Button";

export { buttonVariants };
