"use client";
/**
 * 共通 Autocomplete。入力に応じて候補(サジェスト)を表示し、選択で確定する。
 * 自由入力を許しつつ候補も出したい場面向け(Combobox は選択肢からの選択専用)。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/** {@link Autocomplete} の props。 */
export interface AutocompleteProps {
  /** 入力値。 */
  value: string;
  /** 入力変更時。 */
  onChange: (value: string) => void;
  /** 候補一覧(入力で前方/部分一致フィルタ)。 */
  suggestions: string[];
  /** 候補を選んだとき(未指定なら onChange が呼ばれる)。 */
  onSelect?: (value: string) => void;
  placeholder?: string;
  /** 最大表示件数(既定 8)。 */
  maxItems?: number;
  className?: string;
}

/** サジェスト表示付きテキスト入力。 */
export function Autocomplete({
  value, onChange, suggestions, onSelect, placeholder, maxItems = 8, className,
}: AutocompleteProps) {
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);

  const filtered = React.useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    return suggestions.filter((s) => s.toLowerCase().includes(q)).slice(0, maxItems);
  }, [value, suggestions, maxItems]);

  const choose = (s: string) => {
    (onSelect ?? onChange)(s);
    onChange(s);
    setOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!open || filtered.length === 0) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); const s = filtered[active]; if (s) choose(s); }
          else if (e.key === "Escape") setOpen(false);
        }}
        className="h-9 w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] py-1 shadow-md">
          {filtered.map((s, i) => (
            <li
              key={s}
              onMouseDown={(e) => { e.preventDefault(); choose(s); }}
              onMouseEnter={() => setActive(i)}
              className={cn("cursor-pointer px-3 py-1.5 text-sm", i === active ? "bg-slate-100" : "")}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
