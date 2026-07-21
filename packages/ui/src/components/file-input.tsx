"use client";
/**
 * ファイル選択。**`<input type="file">` の見た目を揃えるための部品**。
 *
 * 生の `<input type="file">` はブラウザごとに見た目が違い、CSS でもほぼ変えられない。
 * `<label>` で隠してボタン風にするのが定石だが、**各画面で書くと揃わない**。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";
import { buttonVariants } from "./button";

/** {@link FileInput} の props。 */
export interface FileInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "size" | "onSelect"> {
  /**
   * ファイルが選ばれたときに呼ばれる。**選び直しできるよう、呼び出し後に値をリセットする**。
   *
   * @remarks
   * リセットしないと、**同じファイルをもう一度選んでも change が飛びません**
   * (「取り込みに失敗したので同じ CSV をもう一度」ができない)。
   */
  onSelect?: (files: File[]) => void;
  /** ボタンに出す文字。**指定するとボタン風**(ファイル名は出ない)。 */
  label?: React.ReactNode;
  /** ボタン風のときの見た目。 */
  variant?: "primary" | "secondary" | "ghost" | "danger";
  /** ボタン風のときの大きさ。 */
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * ファイル選択。
 *
 * @remarks
 * **`label` を渡すとボタン風**、渡さないと素の input(ファイル名が見える)。
 * CSV 取り込みのように「押したら選ぶ」ならボタン風、
 * 「何を選んだか見せたい」なら素のままが良い。
 *
 * @example
 * ```tsx
 * // ボタン風(CSV 取り込み)
 * <FileInput label="CSV を取り込む" accept=".csv" onSelect={([f]) => void importCsv(f)} />
 *
 * // 素のまま(選んだファイル名を見せる)
 * <FileInput accept="image/*" onSelect={([f]) => setImage(f)} />
 *
 * // 複数
 * <FileInput label="添付する" multiple onSelect={(files) => setAttachments(files)} />
 * ```
 */
export function FileInput({ onSelect, label, variant = "secondary", size = "md", className, ...props }: FileInputProps) {
  const ref = React.useRef<HTMLInputElement>(null);

  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) onSelect?.(files);
    // **同じファイルを選び直せるようにする。** リセットしないと change が飛ばない。
    e.target.value = "";
  }

  if (label === undefined) {
    return (
      <input
        ref={ref}
        type="file"
        onChange={handle}
        className={cn(
          "block text-sm text-[var(--color-fg)]",
          "file:mr-3 file:h-9 file:rounded-[var(--radius)] file:border file:border-[var(--color-border)]",
          "file:bg-[var(--color-bg)] file:px-3.5 file:text-sm file:text-[var(--color-fg)]",
          "file:cursor-pointer hover:file:bg-[var(--color-surface)]",
          className,
        )}
        {...props}
      />
    );
  }

  return (
    <label className={cn(buttonVariants({ variant, size }), "cursor-pointer", className)}>
      {label}
      <input ref={ref} type="file" onChange={handle} className="sr-only" {...props} />
    </label>
  );
}
