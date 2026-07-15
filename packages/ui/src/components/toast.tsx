"use client";
/**
 * 共通 Toast(sonner ラッパー)。操作結果の通知に使う。
 * アプリのルートに {@link Toaster} を 1 つ置き、任意の場所から `toast` を呼ぶ。
 * @packageDocumentation
 */
import { Toaster as SonnerToaster, toast } from "sonner";

/** アプリ上位に 1 度だけ置くトースト表示器。 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        style: {
          borderRadius: "var(--radius)",
          border: "1px solid var(--color-border)",
        },
      }}
    />
  );
}

/**
 * トーストを表示する。
 * @example
 * ```ts
 * toast.success("保存しました");
 * toast.error("保存に失敗しました");
 * ```
 */
export { toast };
