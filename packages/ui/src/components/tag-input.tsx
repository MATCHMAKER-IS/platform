"use client";
/**
 * 共通 TagInput。Enter/カンマでタグを追加、× で削除。
 * @packageDocumentation
 */
import * as React from "react";
import { X } from "lucide-react";
import { cn } from "../lib/cn";

/** {@link TagInput} の props。 */
export interface TagInputProps {
  /** 現在のタグ配列。 */
  value: string[];
  /** タグが変わったとき。 */
  onChange: (tags: string[]) => void;
  placeholder?: string;
  /** 重複を許可するか(既定 false)。 */
  allowDuplicates?: boolean;
  className?: string;
}

/** タグ入力。 */
/**
 * タグの入力(複数の短い語を足していく)。
 *
 * 分類・キーワード・宛先のように**数が決まっていないもの**に使う。
 * 選択肢が決まっているなら `Select` や `ToggleGroup` の方が速い
 * (打ち間違いで表記がばらつかない)。
 *
 * - `allowDuplicates` は既定で不可。同じタグを 2 つ付けても意味が無いため
 * - 入力後に Enter か区切り文字で確定する
 * - 既存のタグを候補に出すと、表記のゆれ(「至急」と「大至急」)を防げる
 *
 * @example
 * ```tsx
 * <TagInput value={tags} onChange={setTags} placeholder="Enter で追加" />
 * ```
 */
export function TagInput({ value, onChange, placeholder, allowDuplicates = false, className }: TagInputProps) {
  const [text, setText] = React.useState("");

  const add = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    if (!allowDuplicates && value.includes(t)) { setText(""); return; }
    onChange([...value, t]);
    setText("");
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-1.5 focus-within:ring-2 focus-within:ring-[var(--color-primary)]", className)}>
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-[var(--color-subtle-strong)] px-2 py-0.5 text-sm">
          {tag}
          <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} aria-label={`${tag} を削除`} className="hover:text-[var(--color-danger)]">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={text}
        placeholder={value.length === 0 ? placeholder : ""}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(text); }
          else if (e.key === "Backspace" && text === "" && value.length > 0) onChange(value.slice(0, -1));
        }}
        onBlur={() => add(text)}
        className="min-w-[6rem] flex-1 bg-transparent px-1 text-sm outline-none"
      />
    </div>
  );
}
