/**
 * 共通 Alert(Callout)。ページ内に留まる通知メッセージ。
 * トースト(一時表示)と違い、情報・注意・エラー等を常設で示す。
 * @packageDocumentation
 */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Info, CircleCheck, TriangleAlert, CircleX, X } from "lucide-react";
import { cn } from "../lib/cn.js";

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
export interface AlertProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  /** 見出し。 */
  title?: React.ReactNode;
  /** アイコンを隠す。 */
  hideIcon?: boolean;
  /** 閉じるボタンを表示し、押下時に呼ぶ。 */
  onDismiss?: () => void;
}

/** インライン通知。variant で 情報/成功/注意/エラー を切替。 */
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
