"use client";
/**
 * フォームのセキュリティ/UX ヘルパー(スパム対策・二重送信防止・離脱警告・
 * サーバエラー反映・下書き自動保存)。
 * @packageDocumentation
 */
import * as React from "react";
import { useFormContext, type UseFormReturn, type FieldValues, type Path } from "react-hook-form";
import { Button, Spinner, type ButtonProps } from "@platform/ui";
// **依存は package.json にあったが、`import` が欠けていた。**
// 自動保存（`useFormAutosave`）を呼ぶと `ReferenceError` になる状態だった
// (2026-08、型検査が回っていなかったため気づけなかった)。
import { createWebStorage } from "@platform/web-storage";

/**
 * ハニーポット(スパムボット対策)。人間には見えない入力欄。
 * ボットが値を埋めるので、サーバ側で {@link isHoneypotFilled} が true なら破棄する。
 */
export function HoneypotField({ name = "_hp" }: { name?: string }) {
  const { register } = useFormContext();
  return (
    <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
      <input tabIndex={-1} autoComplete="off" {...register(name)} />
    </div>
  );
}

/**
 * 送信ボタン。送信中は自動で無効化しスピナーを出す(二重送信防止)。
 * `<Form>` 内(react-hook-form のコンテキスト内)で使う。
 */
export function SubmitButton({ children, disabled, ...props }: ButtonProps) {
  const { formState } = useFormContext();
  return (
    <Button type="submit" disabled={disabled || formState.isSubmitting} {...props}>
      {formState.isSubmitting && <Spinner size={16} className="mr-2 text-current" />}
      {children}
    </Button>
  );
}

/** 未保存の変更がある状態でのページ離脱を警告する。 */
export function useUnsavedChangesWarning(when: boolean): void {
  React.useEffect(() => {
    if (!when) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [when]);
}

/** サーバ検証エラー(AppError の details.issues)をフォームの各フィールドに反映する。 */
export function applyServerErrors<T extends FieldValues>(
  form: UseFormReturn<T>,
  error: { details?: { issues?: { path: string; message: string }[] }; message?: string },
): void {
  const issues = error.details?.issues;
  if (issues?.length) {
    for (const issue of issues) form.setError(issue.path as Path<T>, { message: issue.message });
  } else if (error.message) {
    form.setError("root" as Path<T>, { message: error.message });
  }
}

/**
 * 入力内容を自動保存し、再訪時に復元する(下書き)。
 *
 * **`sessionStorage` を直接触らない**(ADR-0020)。
 * プライベートモードや容量超過の扱いを各所で書くことになる。
 *
 * **タブを閉じたら消す。** 下書きは端末に残す必要が無く、
 * 共用端末で次の人に見られると困る。
 *
 * @param form 対象のフォーム
 * @param key 下書きの鍵(画面ごとに変える)
 */
export function useFormAutosave<T extends FieldValues>(form: UseFormReturn<T>, key: string): void {
  const store = React.useMemo(
    () => createWebStorage<Record<string, unknown> | null>({
      key,
      fallback: null,
      kind: "session",
      // **一定時間で無効にする。** 何日も前の下書きが復元されると混乱する
      ttlMs: 24 * 60 * 60 * 1000,
    }),
    [key],
  );

  // 復元
  React.useEffect(() => {
    const saved = store.get();
    if (saved !== null) form.reset(saved as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  // 保存
  React.useEffect(() => {
    const sub = form.watch((values) => {
      // **失敗しても入力は止めない。** 復元できないだけで、送信はできる
      store.set(values as Record<string, unknown>);
    });
    return () => sub.unsubscribe();
  }, [form, store]);
}
