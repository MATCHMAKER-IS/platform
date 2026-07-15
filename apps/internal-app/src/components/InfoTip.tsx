"use client";
/** マウスオーバーで補足を表示する軽量ツールチップ。外部依存なし。 */
import * as React from "react";

export interface InfoTipProps {
  /** 表示する説明文。 */
  text: string;
  /** トリガーに表示するラベル（省略時は "?" マーク）。 */
  label?: React.ReactNode;
}

export function InfoTip({ text, label }: InfoTipProps) {
  const [show, setShow] = React.useState(false);
  return (
    <span className="relative inline-flex items-center" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <span className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-neutral-300 text-[10px] font-bold text-neutral-700" tabIndex={0} onFocus={() => setShow(true)} onBlur={() => setShow(false)} aria-label={text}>
        {label ?? "?"}
      </span>
      {show && (
        <span role="tooltip" className="absolute bottom-full left-1/2 z-50 mb-1 w-56 -translate-x-1/2 rounded bg-neutral-900 px-2 py-1 text-xs leading-snug text-white shadow-lg">
          {text}
        </span>
      )}
    </span>
  );
}
