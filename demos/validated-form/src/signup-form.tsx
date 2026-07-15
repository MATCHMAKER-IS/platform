"use client";
/**
 * フォームバリデーションとトーストの実結線例。
 * @platform/validation の validate(zod スキーマ)で検証し、@platform/form の issuesToFieldErrors で
 * 項目別エラーに整形して表示。送信の成否は @platform/ui の toast で通知する。
 * @packageDocumentation
 */
import * as React from "react";
import { z } from "zod";
import { validate, email } from "@platform/validation";
import { issuesToFieldErrors, hasNoErrors, type FieldErrors } from "@platform/form";
import { Input, Button, toast } from "@platform/ui";

/** 登録スキーマ(@platform/validation の部品 + zod で構成)。 */
const signupSchema = z.object({
  name: z.string().min(1, "お名前を入力してください"),
  email,
  password: z.string().min(8, "パスワードは8文字以上で入力してください"),
});

type SignupValues = z.input<typeof signupSchema>;

/** {@link SignupForm} の props。 */
export interface SignupFormProps {
  /** 登録処理(API 呼び出し等)。投げると失敗トースト。 */
  onSubmit: (values: SignupValues) => Promise<void>;
}

/** 検証 + トースト結線の登録フォーム。 */
export function SignupForm({ onSubmit }: SignupFormProps) {
  const [values, setValues] = React.useState<SignupValues>({ name: "", email: "", password: "" });
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [submitting, setSubmitting] = React.useState(false);

  function set<K extends keyof SignupValues>(key: K, value: SignupValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // @platform/validation で検証 → issue を項目別エラーへ
    const result = validate(signupSchema, values);
    if (!result.ok) {
      const issues = (result.error.details?.issues ?? []) as { path: string; message: string }[];
      setErrors(issuesToFieldErrors(issues));
      toast.error("入力内容を確認してください");
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await onSubmit(result.value);
      toast.success("登録が完了しました");
    } catch {
      toast.error("登録に失敗しました。時間をおいて再度お試しください");
    } finally {
      setSubmitting(false);
    }
  }

  const field = (name: keyof SignupValues, label: string, type = "text") => (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <Input
        type={type}
        value={values[name]}
        onChange={(ev: React.ChangeEvent<HTMLInputElement>) => set(name, ev.target.value)}
        aria-invalid={errors[name] != null}
      />
      {errors[name] != null && <span className="text-xs text-red-600">{errors[name]}</span>}
    </label>
  );

  return (
    <form className="mx-auto flex max-w-sm flex-col gap-4" onSubmit={handleSubmit} noValidate>
      {field("name", "お名前")}
      {field("email", "メールアドレス", "email")}
      {field("password", "パスワード", "password")}
      <Button type="submit" disabled={submitting}>{submitting ? "登録中…" : "登録する"}</Button>
    </form>
  );
}
