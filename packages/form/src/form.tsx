"use client";
/**
 * Form プロバイダと FormField(ラベル・説明・エラー表示を共通化する低レベル部品)。
 * @packageDocumentation
 */
import * as React from "react";
import {
  FormProvider, useController, useFormContext,
  type UseFormReturn, type FieldValues, type SubmitHandler,
} from "react-hook-form";
import { cn } from "@platform/ui";

/** {@link Form} の props。 */
export interface FormProps<T extends FieldValues> {
  /** {@link useZodForm} が返したフォーム。 */
  form: UseFormReturn<T>;
  /** 検証を通過したときの送信処理。 */
  onSubmit: SubmitHandler<T>;
  children: React.ReactNode;
  className?: string;
}

/**
 * `<form>` と react-hook-form のコンテキストを提供する。
 * @example
 * ```tsx
 * <Form form={form} onSubmit={(v) => save(v)}>
 *   <TextField name="email" label="メール" />
 *   <Button type="submit">送信</Button>
 * </Form>
 * ```
 */
export function Form<T extends FieldValues>({ form, onSubmit, children, className }: FormProps<T>) {
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={cn("flex flex-col gap-4", className)} noValidate>
        {children}
      </form>
    </FormProvider>
  );
}

/** FormField の render に渡されるフィールド制御オブジェクト。 */
export interface FieldRenderProps {
  name: string;
  value: unknown;
  onChange: (...args: unknown[]) => void;
  onBlur: () => void;
  ref: React.Ref<unknown>;
  id: string;
  "aria-invalid": boolean;
}

/** {@link FormField} の props。 */
export interface FormFieldProps {
  /** フィールド名(スキーマのキー)。 */
  name: string;
  /** ラベル。 */
  label?: string;
  /** 補足説明(エラーが無いときに表示)。 */
  description?: string;
  /** 必須マーク(*)を表示するか。 */
  required?: boolean;
  /** コントロールを描画する関数。フィールド制御を受け取る。 */
  children: (field: FieldRenderProps) => React.ReactNode;
  className?: string;
}

/**
 * ラベル・コントロール・説明・エラーを縦に並べる共通フィールド枠。
 * 具体的な入力部品は render 関数で描画する(高レベルの {@link TextField} 等はこれを使う)。
 */
export function FormField({ name, label, description, required, children, className }: FormFieldProps) {
  const { control } = useFormContext();
  const { field, fieldState } = useController({ name, control });
  const error = fieldState.error?.message;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={name} className="text-sm font-medium text-[var(--color-fg)]">
          {label}
          {required && <span className="ml-0.5 text-[var(--color-danger)]">*</span>}
        </label>
      )}
      {children({
        name: field.name,
        value: field.value,
        onChange: field.onChange,
        onBlur: field.onBlur,
        ref: field.ref,
        id: name,
        "aria-invalid": !!error,
      })}
      {description && !error && <p className="text-xs text-[var(--color-muted)]">{description}</p>}
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
