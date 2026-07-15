"use client";
/**
 * 規約同意付きサインアップ導線。利用規約を TermsAcceptance で読ませ、同意後に登録フォームを有効化する。
 * @platform/ui の TermsAcceptance + 検証フォーム（@platform/validation）+ トーストの結線例。
 * @packageDocumentation
 */
import * as React from "react";
import { z } from "zod";
import { validate, email } from "@platform/validation";
import { issuesToFieldErrors, type FieldErrors } from "@platform/form";
import { Input, Button, TermsAcceptance, toast } from "@platform/ui";

const schema = z.object({
  name: z.string().min(1, "お名前を入力してください"),
  email,
  password: z.string().min(8, "パスワードは8文字以上で入力してください"),
});
type Values = z.input<typeof schema>;

/** {@link SignupWithConsent} の props。 */
export interface SignupWithConsentProps {
  /** 利用規約の本文。 */
  terms: React.ReactNode;
  onSubmit: (values: Values) => Promise<void>;
}

/** 規約同意 → 登録の導線。 */
export function SignupWithConsent({ terms, onSubmit }: SignupWithConsentProps) {
  const [values, setValues] = React.useState<Values>({ name: "", email: "", password: "" });
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [agreed, setAgreed] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) { toast.error("利用規約への同意が必要です"); return; }
    const result = validate(schema, values);
    if (!result.ok) {
      setErrors(issuesToFieldErrors((result.error.details?.issues ?? []) as { path: string; message: string }[]));
      toast.error("入力内容を確認してください");
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await onSubmit(result.value);
      toast.success("登録が完了しました");
    } catch {
      toast.error("登録に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  const field = (name: keyof Values, label: string, type = "text") => (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <Input type={type} value={values[name]} onChange={(ev: React.ChangeEvent<HTMLInputElement>) => set(name, ev.target.value)} aria-invalid={errors[name] != null} />
      {errors[name] != null && <span className="text-xs text-red-600">{errors[name]}</span>}
    </label>
  );

  return (
    <form className="mx-auto flex max-w-md flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <h1 className="text-lg font-semibold">アカウント登録</h1>
      {field("name", "お名前")}
      {field("email", "メールアドレス", "email")}
      {field("password", "パスワード", "password")}

      {/* 規約を最後まで読むと同意チェックが有効化される */}
      <TermsAcceptance onAcceptedChange={setAgreed} maxHeight="14rem">{terms}</TermsAcceptance>

      <Button type="submit" disabled={!agreed || submitting}>{submitting ? "登録中…" : "同意して登録"}</Button>
    </form>
  );
}
