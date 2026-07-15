# @platform/form

フォーム統合(react-hook-form + zod + `@platform/ui`)。
zod スキーマを渡すだけで、型安全なフォームとラベル・エラー付き入力が使えます。

```tsx
"use client";
import { z } from "zod";
import { email, requiredString, prefecture, password } from "@platform/validation";
import { PREFECTURES } from "@platform/validation";
import { useZodForm, Form, TextField, PasswordField, SelectField, CheckboxField } from "@platform/form";
import { Button } from "@platform/ui";

const schema = z.object({
  name: requiredString(),
  email,
  pref: prefecture,
  password: password(),
  agree: z.boolean().refine((v) => v, "同意が必要です"),
});

export function RegisterForm() {
  const form = useZodForm(schema, { defaultValues: { name: "", email: "" } });
  return (
    <Form form={form} onSubmit={(v) => console.log(v)}>
      <TextField name="name" label="氏名" required />
      <TextField name="email" label="メール" required />
      <SelectField name="pref" label="都道府県" options={PREFECTURES.map((p) => ({ label: p, value: p }))} />
      <PasswordField name="password" label="パスワード" required />
      <CheckboxField name="agree" label="利用規約に同意する" />
      <Button type="submit">登録</Button>
    </Form>
  );
}
```

## 収録
- `useZodForm(schema, options)` … zodResolver 配線済みの `useForm`
- `Form` … `<form>` + コンテキスト提供
- `FormField` … ラベル・説明・エラーを共通化した低レベル枠(render 関数)
- 高レベル: `TextField` / `PasswordField` / `TextareaField` / `SelectField` /
  `ComboboxField` / `CheckboxField` / `SwitchField`

各コントロールの API 差(`value/onChange` と `checked/onCheckedChange` 等)は
高レベルフィールドが吸収するため、アプリは名前とラベルを書くだけで済みます。


## フォームのセキュリティ / UX
- **CSRF**: サーバは `@platform/security` の `createCsrf` でトークンを発行(cookie)・検証。
  クライアントは `<CsrfField />` か `csrfHeaders(useCsrfToken())` で送信に載せる。
- **スパム対策**: `<HoneypotField />`(不可視の囮欄)+ サーバで `isHoneypotFilled(body._hp)` を判定。
- **二重送信防止**: `<SubmitButton>` が送信中に自動で無効化+スピナー表示。
- **離脱警告**: `useUnsavedChangesWarning(form.formState.isDirty)`。
- **サーバ検証エラー反映**: `applyServerErrors(form, appError)` で各フィールドにエラー表示。
- **下書き自動保存**: `useFormAutosave(form, "draft-key")`(sessionStorage)。

```tsx
// サーバ(Route)
import { createCsrf, assertCsrf } from "@platform/security";
const csrf = createCsrf({ secret: env.CSRF_SECRET });
assertCsrf(csrf, req.headers.get("x-csrf-token"), cookies.csrf); // 不正なら 403
```

## 動的フォーム(スキーマ駆動)
フィールドを宣言的に定義し、条件付き表示・多段ステップ・zod スキーマ生成をまとめて扱えます。
```ts
import { type FormField, visibleFields, stripHiddenValues, buildFormSchema, defaultValues } from "@platform/form";

const fields: FormField[] = [
  { name: "type", label: "種別", type: "radio", options: [{ value: "corp", label: "法人" }, { value: "ind", label: "個人" }] },
  { name: "company", label: "会社名", type: "text", required: true, visibleWhen: { field: "type", equals: "corp" } },
  { name: "email", label: "メール", type: "email", required: true },
];

const shown = visibleFields(fields, values);        // 法人選択時のみ会社名を表示
const schema = buildFormSchema(fields);             // zod スキーマを自動生成 → useZodForm に渡す
const clean = stripHiddenValues(fields, values);    // 非表示項目を除外してから送信/検証
```
条件付き表示は `visibleWhen`(equals / notEquals / in / truthy、複数指定は AND)。多段フォームは `stepVisibleFields` / `stepProgress` / `isStepFilled` でステップ制御。すべて純ロジックで、`useZodForm` や `@platform/validation` と組み合わせて使います。

## 入力 → 確認 → 完了 の画面遷移
日本の業務アプリ定番の「入力 → 確認 → 送信 → 完了」を状態として扱います。確認画面のために入力を保持し、二重送信を防ぎます。
```tsx
import { useSubmitFlow, reviewItems } from "@platform/form";

function ApplyScreen({ fields }) {
  const flow = useSubmitFlow<FormValues>();

  if (flow.phase === "input")
    return <InputForm fields={fields} onSubmit={(values) => flow.toConfirm(values)} />;

  if (flow.phase === "confirm")
    return (
      <Confirm items={reviewItems(fields, flow.data)}      // 「ラベル: 値」で見直し(選択肢はラベル、真偽は はい/いいえ)
        submitting={flow.submitting} error={flow.error}
        onBack={flow.toEdit}                                // 入力へ戻る(内容は保持)
        onSubmit={() => flow.submit(async (data) => { await api.create(data); })} />
    );

  return <Complete onReset={flow.reset} />;                 // 完了画面
}
```
純ロジックの `flow.ts`(`reviewData`/`editAgain`/`submitSucceeded` 等)だけでも使えます。段階表示は `phaseIndex`。

## 詳細画面の項目生成
```ts
import { describeRecord } from "@platform/form";
const items = describeRecord(fields, record);  // 全フィールドを「ラベル: 値」で(詳細画面/description-list 表示に)
```

## 一覧画面(検索/ソート/ページング/選択)
取得済み行の絞り込み・並び替え・ページングは `@platform/ui` の `queryRows`、選択状態(複数選択・一括操作)は同 `toggleRow`/`toggleAll`/`isIndeterminate` を使います(大量データはサーバー側の `@platform/db` ページング)。

## バリデーション結果 → 項目別エラー
`@platform/validation` の `validate()` が返す issue 配列を、各入力欄に出せる形へ整形します。
```ts
import { validate } from "@platform/validation";
import { issuesToFieldErrors, hasNoErrors } from "@platform/form";

const result = validate(schema, values);
if (!result.ok) {
  const errors = issuesToFieldErrors(result.error.details?.issues ?? []);  // { email: "…", password: "…" }
  // errors[name] を各入力の下に表示
}
```
実結線の例は `demos/validated-form`（検証 + トースト）を参照。

