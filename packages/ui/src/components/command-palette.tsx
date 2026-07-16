"use client";
/**
 * コマンドパレット(⌘K)。検索窓 + 絞り込み結果 + キーボード操作(↑↓/Enter/Esc)。
 * ページ遷移やアクションへの素早いアクセスを提供する。開閉はアプリ側で管理(controlled)。
 * @packageDocumentation
 */
import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "../lib/cn";
import { type Command, filterCommands, groupCommands, nextIndex } from "../lib/command";

/** {@link CommandPalette} の props。 */
export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: Command[];
  /** コマンド選択時(href が無い操作の実行)。選択後は自動で閉じる。 */
  onSelect?: (command: Command) => void;
  /** プレースホルダ(既定「コマンドやページを検索…」)。 */
  placeholder?: string;
  /** 結果の最大件数(既定 50)。 */
  limit?: number;
}

/** ⌘K で開く検索/コマンドパレット。 */
export function CommandPalette({ open, onOpenChange, commands, onSelect, placeholder = "コマンドやページを検索…", limit = 50 }: CommandPaletteProps) {
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const results = React.useMemo(() => filterCommands(commands, query, limit), [commands, query, limit]);
  const groups = React.useMemo(() => groupCommands(results), [results]);

  // 開いたら入力にフォーカスし、状態をリセット
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      inputRef.current?.focus();
    }
  }, [open]);

  // クエリ変更で選択位置を先頭へ
  React.useEffect(() => { setActive(0); }, [query]);

  function choose(command: Command) {
    if (command.disabled) return;
    onOpenChange(false);
    onSelect?.(command);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => nextIndex(i, results.length, 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => nextIndex(i, results.length, -1)); }
    else if (e.key === "Enter") { e.preventDefault(); const c = results[active]; if (c) choose(c); }
    else if (e.key === "Escape") { e.preventDefault(); onOpenChange(false); }
  }

  if (!open) return null;

  // グループ表示のためのフラットな通し番号(active と対応)
  let runningIndex = -1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh]" onClick={() => onOpenChange(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="コマンドパレット"
        className="w-full max-w-lg overflow-hidden rounded-[calc(var(--radius)*1.5)] border border-[var(--color-border)] bg-white shadow-2xl"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4">
          <Search size={18} className="shrink-0 text-[var(--color-muted)]" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="h-12 flex-1 bg-transparent text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:outline-none"
            aria-label={placeholder}
          />
        </div>

        <div className="max-h-80 overflow-y-auto py-2">
          {results.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[var(--color-muted)]">該当するコマンドがありません</p>
          ) : (
            groups.map((g) => (
              <div key={g.group}>
                <div className="px-4 py-1.5 text-xs font-medium text-[var(--color-muted)]">{g.group}</div>
                <ul>
                  {g.commands.map((command) => {
                    runningIndex += 1;
                    const idx = runningIndex;
                    const isActive = idx === active;
                    return (
                      <li key={command.id}>
                        <button
                          type="button"
                          disabled={command.disabled}
                          onMouseEnter={() => setActive(idx)}
                          onClick={() => choose(command)}
                          className={cn(
                            "flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors disabled:opacity-40",
                            isActive ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)]" : "text-[var(--color-fg)] hover:bg-slate-50",
                          )}
                        >
                          {command.icon != null && <span className="shrink-0">{command.icon as React.ReactNode}</span>}
                          <span className="flex-1 truncate">{command.label}</span>
                          {command.shortcut != null && (
                            <kbd className={cn("rounded px-1.5 py-0.5 text-xs", isActive ? "bg-white/20" : "bg-slate-100 text-[var(--color-muted)]")}>{command.shortcut}</kbd>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
