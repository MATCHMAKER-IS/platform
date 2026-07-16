/**
 * 共通 SearchInput。検索アイコン付き入力。クリアボタンと Enter/変更コールバックを備える。
 * @packageDocumentation
 */
import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "../lib/cn";

/** {@link SearchInput} の props。 */
export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  /** 値(制御コンポーネント)。 */
  value?: string;
  /** 値変更(文字列を直接受け取る)。 */
  onValueChange?: (value: string) => void;
  /** Enter 押下時(検索実行)。 */
  onSearch?: (value: string) => void;
  /** クリアボタンを表示する(既定 true)。 */
  clearable?: boolean;
}

/** 検索入力。アイコン + クリア + Enter で検索。 */
export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, value, onValueChange, onSearch, clearable = true, placeholder = "検索…", ...props }, ref) => (
    <div className={cn("relative inline-flex w-full items-center", className)}>
      <Search className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--color-muted)]" aria-hidden />
      <input
        ref={ref}
        type="search"
        role="searchbox"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onValueChange?.(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onSearch?.((e.target as HTMLInputElement).value); }}
        className="h-10 w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] pl-9 pr-9 text-sm text-[var(--color-fg)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] [&::-webkit-search-cancel-button]:hidden"
        {...props}
      />
      {clearable && value ? (
        <button type="button" aria-label="クリア" onClick={() => { onValueChange?.(""); onSearch?.(""); }}
          className="absolute right-3 text-[var(--color-muted)] hover:text-[var(--color-fg)]">
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  ),
);
SearchInput.displayName = "SearchInput";
