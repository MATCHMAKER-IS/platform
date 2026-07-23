/**
 * 共通 Spinner / LoadingOverlay。読み込み中表示。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/** {@link Spinner} の props。 */
export interface SpinnerProps extends React.SVGAttributes<SVGSVGElement> {
  /** サイズ(px)。既定 20。 */
  size?: number;
}

/** 回転スピナー。 */
/**
 * 読み込み中の回転。
 *
 * **いつ終わるか分からない**処理に使う。終わりが分かるなら `Progress`。
 * 3 秒を超えるなら「何をしているか」を文字で添える
 * (「集計しています」だけで、待つ気持ちが変わる)。
 */
export function Spinner({ size = 20, className, ...props }: SpinnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cn("animate-spin text-[var(--color-primary)]", className)}
      {...props}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** 全面を覆うローディングオーバーレイ。`show` が true の間だけ表示。 */
export function LoadingOverlay({ show, label }: { show: boolean; label?: string }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-white/70 backdrop-blur-sm">
      <Spinner size={32} />
      {label && <span className="text-sm text-[var(--color-muted)]">{label}</span>}
    </div>
  );
}
