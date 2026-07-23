"use client";
/**
 * 共通 BackToTop。一定量スクロールすると現れ、押すとページ先頭へスムーズに戻るボタン。
 * @packageDocumentation
 */
import * as React from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "../lib/cn";

/** {@link BackToTop} の props。 */
export interface BackToTopProps {
  /** 表示し始めるスクロール量(px)。既定 300。 */
  threshold?: number;
  /** スクロール対象。省略時は window。特定のスクロール領域なら ref を渡す。 */
  target?: React.RefObject<HTMLElement>;
  /** ボタンの位置・見た目の追加クラス。 */
  className?: string;
  /** アクセシブルラベル(既定「ページトップに戻る」)。 */
  label?: string;
}

/** ページトップへ戻るフローティングボタン。 */
/**
 * 先頭へ戻るボタン。
 *
 * 長い一覧や文書で、下まで見た人を上へ戻す。
 * **ある程度スクロールしてから出す**(最初から出ていると場所を取るだけ)。
 */
export function BackToTop({ threshold = 300, target, className, label = "ページトップに戻る" }: BackToTopProps) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const el = target?.current;
    const scroller: HTMLElement | Window = el ?? window;
    const getY = () => (el ? el.scrollTop : window.scrollY);
    const onScroll = () => setVisible(getY() > threshold);
    onScroll();
    scroller.addEventListener("scroll", onScroll, { passive: true } as AddEventListenerOptions);
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [threshold, target]);

  const toTop = () => {
    const el = target?.current;
    (el ?? window).scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!visible) return null;
  return (
    <button
      type="button"
      onClick={toTop}
      aria-label={label}
      title={label}
      className={cn(
        "fixed bottom-6 right-6 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-fg)] shadow-lg transition-opacity hover:bg-[var(--color-subtle)]",
        className,
      )}
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
