"use client";
/**
 * メールログインフォーム。メールアドレス + パスワードでのログイン入力。
 * LoginCard の children に渡してソーシャルログインと併用できる。送信処理はアプリ側。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";
import { validateEmailLogin, isLoginFormValid, type LoginFormErrors } from "../lib/login-form";

/** 送信される値。 */
export interface EmailLoginValues {
  email: string;
  password: string;
  remember: boolean;
}

/** {@link EmailLoginForm} の props。 */
export interface EmailLoginFormProps {
  /** 送信ハンドラ(検証を通過した値)。 */
  onSubmit?: (values: EmailLoginValues) => void;
  /** 送信中(操作不可・ボタン文言変化)。 */
  loading?: boolean;
  /** 初期メールアドレス。 */
  defaultEmail?: string;
  /** 送信ボタンの文言(既定「ログイン」)。 */
  submitLabel?: string;
  /** 「ログイン状態を保持」を表示するか。 */
  showRemember?: boolean;
  /** パスワード再設定リンクの遷移先。 */
  forgotHref?: string;
  /** パスワード最小文字数(既定 8)。 */
  minPasswordLength?: number;
  className?: string;
}

/** メール + パスワードのログインフォーム。 */
export function EmailLoginForm({
  onSubmit,
  loading = false,
  defaultEmail = "",
  submitLabel = "ログイン",
  showRemember = false,
  forgotHref,
  minPasswordLength = 8,
  className,
}: EmailLoginFormProps) {
  const [email, setEmail] = React.useState(defaultEmail);
  const [password, setPassword] = React.useState("");
  const [remember, setRemember] = React.useState(false);
  const [errors, setErrors] = React.useState<LoginFormErrors>({});
  const [touched, setTouched] = React.useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = validateEmailLogin(email, password, { minPasswordLength });
    setErrors(found);
    setTouched(true);
    if (isLoginFormValid(found)) onSubmit?.({ email: email.trim(), password, remember });
  }

  const fieldClass =
    "mt-1 block w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-fg)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]";

  return (
    <form className={cn("flex flex-col gap-4", className)} onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="login-email" className="text-sm font-medium text-[var(--color-fg)]">メールアドレス</label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
          className={cn(fieldClass, touched && errors.email && "border-red-400")}
          aria-invalid={touched && !!errors.email}
        />
        {touched && errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="login-password" className="text-sm font-medium text-[var(--color-fg)]">パスワード</label>
          {forgotHref && <a href={forgotHref} className="text-xs text-[var(--color-primary)] hover:underline">お忘れですか？</a>}
        </div>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
          className={cn(fieldClass, touched && errors.password && "border-red-400")}
          aria-invalid={touched && !!errors.password}
        />
        {touched && errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
      </div>

      {showRemember && (
        <label className="flex items-center gap-2 text-sm text-[var(--color-fg)]">
          <input type="checkbox" checked={remember} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRemember(e.target.checked)} className="rounded border-[var(--color-border)]" />
          ログイン状態を保持する
        </label>
      )}

      <button
        type="submit"
        disabled={loading}
        aria-busy={loading}
        className="inline-flex h-9 items-center justify-center rounded-[var(--radius)] bg-[var(--color-primary)] px-4 text-sm font-medium text-[var(--color-primary-fg)] transition-colors hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
      >
        {loading ? "処理中…" : submitLabel}
      </button>
    </form>
  );
}
