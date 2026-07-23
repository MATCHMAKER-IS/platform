/**
 * 共通 Alert(Callout)。ページ内に留まる通知メッセージ。
 * トースト(一時表示)と違い、情報・注意・エラー等を常設で示す。
 * @packageDocumentation
 */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Info, CircleCheck, TriangleAlert, CircleX, X } from "lucide-react";
import { cn } from "../lib/cn";

const alertVariants = cva(
  "relative flex gap-3 rounded-[var(--radius)] border p-4 text-sm",
  {
    variants: {
      variant: {
        info: "border-sky-200 bg-sky-50 text-sky-800",
        success: "border-emerald-200 bg-emerald-50 text-emerald-800",
        warning: "border-amber-200 bg-amber-50 text-amber-800",
        danger: "border-red-200 bg-red-50 text-[var(--color-danger)]",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

const ICONS = { info: Info, success: CircleCheck, warning: TriangleAlert, danger: CircleX } as const;

/** {@link Alert} の props。 */
export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">, VariantProps<typeof alertVariants> {
  /** 見出し。 */
  title?: React.ReactNode;
  /** アイコンを隠す。 */
  hideIcon?: boolean;
  /** 閉じるボタンを表示し、押下時に呼ぶ。 */
  onDismiss?: () => void;
}

/**
 * 画面の中に置く通知。
 *
 * **その画面で今起きていること**を伝える。操作の結果を一時的に見せたいだけなら
 * トースト(`useToast`)の方が邪魔にならない。逆に、読まずに消されると困る内容
 * (入力の誤り・データの欠落・法令上の注意)は Alert で残す。
 *
 * variant の使い分け:
 * | variant | 使う場面 |
 * |---|---|
 * | `info` | 補足の説明・仕組みの案内 |
 * | `success` | 処理が終わったことの確認 |
 * | `warning` | まだ失敗ではないが、放置すると困ること |
 * | `danger` | 失敗・できないことの説明 |
 *
 * **「エラーが発生しました」で終わらせない。** 何が起きて、次に何をすればよいかを書く。
 *
 * @example
 * ```tsx
 * <Alert variant="warning" title="期限が近づいています">
 *   3 日以内に承認されないと差し戻されます。
 * </Alert>
 *
 * // 閉じられるようにする(読み終えたら消してよい内容のとき)
 * <Alert variant="info" onDismiss={() => setShown(false)}>保存しました</Alert>
 * ```
 */
export function Alert({ className, variant = "info", title, hideIcon, onDismiss, children, ...props }: AlertProps) {
  const IconCmp = ICONS[variant ?? "info"];
  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      {!hideIcon && <IconCmp className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
      <div className="min-w-0 flex-1">
        {title && <div className="mb-0.5 font-semibold">{title}</div>}
        {children && <div className="text-[0.9em] opacity-90">{children}</div>}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="閉じる" className="shrink-0 opacity-60 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
