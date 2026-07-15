"use client";
/**
 * 会員登録フォームのデモ。validation + form + ui + address を束ねた縦一本。
 * - useZodForm でスキーマから型安全なフォーム
 * - 高レベルフィールドでラベル・エラーを 1 行記述
 * - 郵便番号 → 住所オートフィル(@platform/address のサーバ API)
 * - パスワード確認一致(zod refine)
 */
import { useState } from "react";
import { z } from "zod";
import {
  requiredString, email, prefecture, password, agreement, zipCodeJp, PREFECTURES,
} from "@platform/validation";
import {
  useZodForm, Form, TextField, PasswordField, SelectField, CheckboxField, TextareaField,
  CsrfField, HoneypotField, SubmitButton, useCsrfToken, csrfHeaders,
  applyServerErrors, useUnsavedChangesWarning,
} from "@platform/form";
import { Button, toast } from "@platform/ui";
import { useEffect } from "react";

const schema = z
  .object({
    name: requiredString("氏名は必須です"),
    email,
    zip: zipCodeJp,
    pref: prefecture,
    city: requiredString("市区町村は必須です"),
    note: z.string().optional(),
    password: password({ minLength: 8 }),
    confirmPassword: z.string(),
    agree: agreement,
    _hp: z.string().optional(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "パスワードが一致しません",
    path: ["confirmPassword"],
  });

export default function Page() {
  const [submitted, setSubmitted] = useState<string | null>(null);
  const form = useZodForm(schema, {
    defaultValues: { name: "", email: "", zip: "", city: "", note: "", password: "", confirmPassword: "", agree: false, _hp: "" },
  });
  const csrfToken = useCsrfToken();
  useUnsavedChangesWarning(form.formState.isDirty && !submitted);

  // 初回に CSRF トークンを取得(cookie セット)
  useEffect(() => { void fetch("/api/csrf"); }, []);

  async function onSubmit(values: Record<string, unknown>) {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "content-type": "application/json", ...csrfHeaders(csrfToken) },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      applyServerErrors(form, err.error ?? {});
      toast.error(err.error?.message ?? "送信に失敗しました");
      return;
    }
    setSubmitted(JSON.stringify({ ...values, password: "***", confirmPassword: "***", _hp: undefined }, null, 2));
    toast.success("登録しました");
  }

  async function lookupAddress() {
    const zip = form.getValues("zip");
    const res = await fetch(`/api/address?zip=${encodeURIComponent(zip)}`);
    const data = await res.json();
    const hit = data.results?.[0];
    if (hit) {
      form.setValue("pref", hit.prefecture, { shouldValidate: true });
      form.setValue("city", `${hit.city}${hit.town}`, { shouldValidate: true });
    }
  }

  const prefOptions = PREFECTURES.map((p) => ({ label: p, value: p }));

  return (
    <main style={{ maxWidth: 520, margin: "3rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>会員登録フォーム</h1>
      <p style={{ color: "var(--color-muted)", marginBottom: "1rem" }}>
        validation + form + ui + address を束ねたデモ。郵便番号から住所を自動入力します。
      </p>

      <Form form={form} onSubmit={onSubmit}>
        <CsrfField />
        <HoneypotField />
        <TextField name="name" label="氏名" required placeholder="山田 太郎" />
        <TextField name="email" label="メールアドレス" required placeholder="taro@example.co.jp" />

        <div style={{ display: "flex", gap: ".5rem", alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <TextField name="zip" label="郵便番号" required placeholder="100-0001" />
          </div>
          <Button type="button" variant="secondary" onClick={lookupAddress}>住所検索</Button>
        </div>

        <SelectField name="pref" label="都道府県" options={prefOptions} placeholder="選択してください" />
        <TextField name="city" label="市区町村・番地" required />
        <TextareaField name="note" label="備考" placeholder="任意" />

        <PasswordField name="password" label="パスワード" required placeholder="8文字以上・英大小+数字" />
        <PasswordField name="confirmPassword" label="パスワード(確認)" required />

        <CheckboxField name="agree" label="利用規約に同意する" />

        <SubmitButton>登録する</SubmitButton>
      </Form>

      {submitted && (
        <pre style={{ marginTop: "1.5rem", padding: "1rem", background: "#f8fafc", borderRadius: "var(--radius)", fontSize: ".8rem", overflow: "auto" }}>
          送信内容:{"\n"}{submitted}
        </pre>
      )}
      <p style={{ marginTop: "1.5rem" }}><a href="/">← 戻る</a></p>
    </main>
  );
}
