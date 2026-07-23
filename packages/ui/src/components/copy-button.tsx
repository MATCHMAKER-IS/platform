"use client";
/**
 * コピーボタン。テキストをクリップボードにコピーし、成功を短時間フィードバックする。
 * @packageDocumentation
 */
import * as React from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "../lib/cn";
import { copyToClipboard, readClipboard } from "../lib/clipboard";

/** クリップボードにコピーするフック。[コピー済みか, コピー実行] を返す。 */
export function useCopyToClipboard(resetMs = 2000): [boolean, (text: string) => Promise<void>] {
  const [copied, setCopied] = React.useState(false);
  const copy = React.useCallback(async (text: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), resetMs);
    }
  }, [resetMs]);
  return [copied, copy];
}

/** クリップボードから貼り付けるフック。[最後に貼り付けた文字列, 貼り付け実行] を返す。 */
export function usePaste(): [string | null, () => Promise<string | null>] {
  const [last, setLast] = React.useState<string | null>(null);
  const paste = React.useCallback(async () => {
    const text = await readClipboard();
    if (text !== null) setLast(text);
    return text;
  }, []);
  return [last, paste];
}

/** {@link CopyButton} の props。 */
export interface CopyButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** コピーする文字列。 */
  value: string;
  /** ラベル(既定「コピー」。アイコンのみにするなら空文字)。 */
  label?: string;
  /** コピー後のラベル(既定「コピーしました」)。 */
  copiedLabel?: string;
}

/** テキストをコピーするボタン(コピー後にチェック表示)。 */
/**
 * 押すとコピーするボタン。
 *
 * ID・URL・エラー番号など、**手で写すと間違えるもの**の横に置く。
 * コピーできたことを必ず伝える(押した手応えが無いと何度も押される)。
 */
export const CopyButton = React.forwardRef<HTMLButtonElement, CopyButtonProps>(
  ({ value, label = "コピー", copiedLabel = "コピーしました", className, ...props }, ref) => {
    const [copied, copy] = useCopyToClipboard();
    return (
      <button
        ref={ref}
        type="button"
        onClick={() => copy(value)}
        aria-label={copied ? copiedLabel : label || "コピー"}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--color-border)] px-2.5 py-1.5 text-sm text-[var(--color-fg)] transition-colors hover:bg-[var(--color-subtle)]",
          className,
        )}
        {...props}
      >
        {copied ? <Check size={15} className="text-[var(--color-success)]" aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
        {label !== "" && <span>{copied ? copiedLabel : label}</span>}
      </button>
    );
  },
);
CopyButton.displayName = "CopyButton";
