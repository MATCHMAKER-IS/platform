"use client";
/**
 * 値をひとつ尋ねるダイアログ。
 *
 * 【なぜ要るか】
 * `window.prompt` は手軽だが、次の問題がある。
 *
 * - **見た目がブラウザ任せ**で、アプリの中で浮く
 * - **入力の種類を指定できない**(金額なのに数字キーパッドが出ない)
 * - **その場で検証できない**。「入金額を入力してください」に
 *   「abc」と入れられ、閉じてから弾くことになる
 * - **一部のブラウザで無効化**されている(表示されず、処理が進まない)
 *
 * 2026-08 に 7 か所で使われていた。金額の入力にも使われており、
 * 数字以外を弾く仕組みが無かった。
 * @packageDocumentation
 */
import * as React from "react";
import { Button } from "./button";
import { Input } from "./input";
import { cn } from "../lib/cn";

/** {@link PromptDialog} の props。 */
export interface PromptDialogProps {
  open: boolean;
  onClose: () => void;
  /** 値が確定したとき。**空文字では呼ばれない**。 */
  onSubmit: (value: string) => void | Promise<void>;
  /** 見出し。**何を尋ねるか**を書く(「入力」ではなく「入金額を入力」)。 */
  title: React.ReactNode;
  /** 補足。単位や範囲を書く。 */
  description?: React.ReactNode;
  /** 入力欄のラベル。 */
  label?: string;
  /**
   * 入力の種類。`number` なら数字キーパッドが出る。
   *
   * **`email` / `tel` はスマホのキーボードが変わる**ので、
   * 宛先を尋ねる用途では指定する(2026-08 に `email` を足した)。
   * **形式の検証はブラウザ任せにしないこと**——`validate` で見る。
   */
  type?: "text" | "number" | "date" | "email" | "tel";
  /** 初期値。 */
  defaultValue?: string;
  /** 確定ボタンの文字。 */
  submitLabel?: string;
  /**
   * 値を確かめる。**エラーの文言を返すと確定させない**。
   *
   * 閉じてから弾くのではなく、その場で伝える。
   */
  validate?: (value: string) => string | undefined;
  className?: string;
}

/**
 * 値をひとつ尋ねる。
 *
 * @param title 何を尋ねるか
 * @returns ダイアログ
 *
 * @example
 * ```tsx
 * <PromptDialog
 *   open={paying !== null}
 *   onClose={() => setPaying(null)}
 *   onSubmit={(v) => void pay(paying, Number(v))}
 *   title="入金額を入力"
 *   label="金額(円)"
 *   type="number"
 *   validate={(v) => (Number(v) > 0 ? undefined : "1 円以上を入力してください")}
 * />
 * ```
 */
export function PromptDialog({
  open, onClose, onSubmit, title, description, label = "値",
  type = "text", defaultValue = "", submitLabel = "決定", validate, className,
}: PromptDialogProps) {
  const [value, setValue] = React.useState(defaultValue);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // **開いたら入力欄に合わせる。** 開くたびに初期値へ戻す
  React.useEffect(() => {
    if (!open) return;
    setValue(defaultValue);
    setError("");
    inputRef.current?.focus();
  }, [open, defaultValue]);

  // Esc で閉じる。**閉じられない画面は怖い**
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const run = async () => {
    // **処理中なら何もしない。** ボタンは `loading` で無効になるが、
    // **Enter は入力欄から呼ばれる**ので無効化が効かない——
    // 反応が無いと思って Enter を連打すると、**入金や支払が二重に計上される**。
    // 2026-08 まで守っておらず、`invoices` / `payables` / `purchase-orders` の
    // 金額確定がこの経路にあった
    if (busy) return;
    const v = value.trim();
    if (v === "") { setError(`${label}を入力してください`); return; }
    // **その場で弾く。** 閉じてから「不正でした」では、入力をやり直させる
    const message = validate?.(v);
    if (message !== undefined) { setError(message); return; }
    setBusy(true);
    try {
      await onSubmit(v);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-title"
      onClick={onClose}
    >
      {/* **中身のクリックで閉じない。**
          `onClick` ではなく `onMouseDown` で止める。
          `onClick` を付けると「押せる要素」と誤解され、
          キーボード操作が無いことを検査に指摘される(実際は押す場所ではない) */}
      <div
        className={cn("w-full max-w-sm rounded-[var(--radius)] bg-[var(--color-bg)] p-5 shadow-lg", className)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="prompt-title" className="mb-2 font-semibold text-[var(--color-fg)]">{title}</h2>
        {description !== undefined && (
          <p className="mb-3 text-sm text-[var(--color-muted)]">{description}</p>
        )}
        <label className="block">
          <span className="mb-1 block text-sm">{label}</span>
          <Input
            ref={inputRef}
            type={type}
            value={value}
            // 金額なら数字キーパッドを出す
            {...(type === "number" ? { inputMode: "numeric" as const } : {})}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setValue(e.target.value); setError(""); }}
            // **変換中の Enter は無視する。** 日本語入力では漢字を選ぶ操作が Enter で、
            // 見ないと変換を確定した瞬間にダイアログが実行される
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) void run();
            }}
          />
        </label>
        {error !== "" && <p className="mt-1 text-sm text-[var(--color-danger)]">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>やめる</Button>
          <Button loading={busy} loadingLabel="処理中…" onClick={() => void run()}>{submitLabel}</Button>
        </div>
      </div>
    </div>
  );
}
