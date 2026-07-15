/**
 * 共通 Steps(ステッパー)。多段フローの進捗表示。
 * @packageDocumentation
 */
import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "../lib/cn.js";

/** {@link Steps} の props。 */
export interface StepsProps {
  /** 各ステップのラベル。 */
  steps: string[];
  /** 現在のステップ(0 始まり)。これ未満は完了扱い。 */
  current: number;
  className?: string;
}

/** 横型ステッパー。 */
export function Steps({ steps, current, className }: StepsProps) {
  return (
    <ol className={cn("flex items-center", className)}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium",
                  done && "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-fg)]",
                  active && "border-[var(--color-primary)] text-[var(--color-primary)]",
                  !done && !active && "border-[var(--color-border)] text-[var(--color-muted)]",
                )}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className={cn("text-xs", active ? "text-[var(--color-fg)]" : "text-[var(--color-muted)]")}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <span className={cn("mx-2 h-0.5 flex-1", i < current ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
