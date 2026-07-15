/**
 * 共通 Select(プルダウン)。アクセシブルなラベル付きの薄いラッパー。
 * より高機能なコンボボックスは Radix/shadcn を包んで別途追加する想定。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn.js";

/** プルダウンの選択肢。 */
export interface SelectOption {
  label: string;
  value: string;
}

/** {@link Select} の props。 */
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  /** 先頭に出す未選択プレースホルダ。 */
  placeholder?: string;
}

/**
 * 共通プルダウン。
 * @example
 * ```tsx
 * <Select
 *   placeholder="部署を選択"
 *   options={[{ label: "営業", value: "sales" }, { label: "開発", value: "dev" }]}
 *   onChange={(e) => setDept(e.target.value)}
 * />
 * ```
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, placeholder, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-10 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-fg)] focus-visible:outline-none focus-visible:ring-2",
        className,
      )}
      {...props}
    >
      {placeholder ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
);
Select.displayName = "Select";
