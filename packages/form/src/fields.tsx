"use client";
/**
 * 高レベルのフィールド部品。@platform/ui のコントロールを react-hook-form に配線し、
 * ラベル・エラー付きで 1 行で書けるようにする。各コントロールの API 差
 * (value/onChange と checked/onCheckedChange 等)はここで吸収する。
 * @packageDocumentation
 */
import * as React from "react";
import {
  Input, PasswordInput, Textarea, Select, Checkbox, Switch, Combobox,
  type SelectOption, type ComboboxOption,
} from "@platform/ui";
import { FormField, type FormFieldProps } from "./form.js";

/** フィールド共通の props(FormField のうち children を除く)。 */
type BaseFieldProps = Omit<FormFieldProps, "children">;

/** 1 行テキスト入力フィールド。 */
export function TextField({
  name, label, description, required, className, ...inputProps
}: BaseFieldProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name">) {
  return (
    <FormField name={name} label={label} description={description} required={required} className={className}>
      {(field) => (
        <Input
          id={field.id}
          name={field.name}
          value={(field.value as string) ?? ""}
          onChange={field.onChange}
          onBlur={field.onBlur}
          aria-invalid={field["aria-invalid"]}
          {...inputProps}
        />
      )}
    </FormField>
  );
}

/** パスワード入力フィールド(表示切替付き)。 */
export function PasswordField({
  name, label, description, required, className, ...inputProps
}: BaseFieldProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "type">) {
  return (
    <FormField name={name} label={label} description={description} required={required} className={className}>
      {(field) => (
        <PasswordInput
          id={field.id}
          name={field.name}
          value={(field.value as string) ?? ""}
          onChange={field.onChange}
          onBlur={field.onBlur}
          aria-invalid={field["aria-invalid"]}
          {...inputProps}
        />
      )}
    </FormField>
  );
}

/** 複数行テキストフィールド。 */
export function TextareaField({
  name, label, description, required, className, ...props
}: BaseFieldProps & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name">) {
  return (
    <FormField name={name} label={label} description={description} required={required} className={className}>
      {(field) => (
        <Textarea
          id={field.id}
          name={field.name}
          value={(field.value as string) ?? ""}
          onChange={field.onChange}
          onBlur={field.onBlur}
          {...props}
        />
      )}
    </FormField>
  );
}

/** セレクト(ドロップダウン)フィールド。 */
export function SelectField({
  name, label, description, required, className, options, placeholder,
}: BaseFieldProps & { options: SelectOption[]; placeholder?: string }) {
  return (
    <FormField name={name} label={label} description={description} required={required} className={className}>
      {(field) => (
        <Select
          id={field.id}
          name={field.name}
          value={(field.value as string) ?? ""}
          onChange={field.onChange}
          onBlur={field.onBlur}
          options={options}
          placeholder={placeholder}
        />
      )}
    </FormField>
  );
}

/** 検索付きコンボボックスフィールド。 */
export function ComboboxField({
  name, label, description, required, className, options, placeholder,
}: BaseFieldProps & { options: ComboboxOption[]; placeholder?: string }) {
  return (
    <FormField name={name} label={label} description={description} required={required} className={className}>
      {(field) => (
        <Combobox
          options={options}
          value={field.value as string | undefined}
          onChange={(v) => field.onChange(v)}
          placeholder={placeholder}
        />
      )}
    </FormField>
  );
}

/** チェックボックスフィールド(ラベルは右横に表示)。 */
export function CheckboxField({
  name, label, description, required, className,
}: BaseFieldProps) {
  return (
    <FormField name={name} description={description} required={required} className={className}>
      {(field) => (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-fg)]">
          <Checkbox
            checked={!!field.value}
            onCheckedChange={(v) => field.onChange(!!v)}
          />
          {label}
        </label>
      )}
    </FormField>
  );
}

/** スイッチフィールド(オン/オフ、ラベルは右横)。 */
export function SwitchField({
  name, label, description, required, className,
}: BaseFieldProps) {
  return (
    <FormField name={name} description={description} required={required} className={className}>
      {(field) => (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-fg)]">
          <Switch checked={!!field.value} onCheckedChange={(v) => field.onChange(!!v)} />
          {label}
        </label>
      )}
    </FormField>
  );
}

// ---- 追加フィールド ----
import {
  RadioGroup, RadioGroupItem, NumberInput, DatePicker, TimePicker, ColorPicker,
} from "@platform/ui";

/** 数値フィールド。 */
export function NumberField({
  name, label, description, required, className, ...props
}: BaseFieldProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "type">) {
  return (
    <FormField name={name} label={label} description={description} required={required} className={className}>
      {(field) => (
        <NumberInput
          id={field.id}
          name={field.name}
          value={(field.value as number | string) ?? ""}
          onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          onBlur={field.onBlur}
          {...props}
        />
      )}
    </FormField>
  );
}

/** 日付フィールド(値は "YYYY-MM-DD")。 */
export function DateField({ name, label, description, required, className }: BaseFieldProps) {
  return (
    <FormField name={name} label={label} description={description} required={required} className={className}>
      {(field) => (
        <DatePicker id={field.id} name={field.name} value={(field.value as string) ?? ""} onChange={field.onChange} onBlur={field.onBlur} />
      )}
    </FormField>
  );
}

/** 時刻フィールド(値は "HH:mm")。 */
export function TimeField({ name, label, description, required, className }: BaseFieldProps) {
  return (
    <FormField name={name} label={label} description={description} required={required} className={className}>
      {(field) => (
        <TimePicker id={field.id} name={field.name} value={(field.value as string) ?? ""} onChange={field.onChange} onBlur={field.onBlur} />
      )}
    </FormField>
  );
}

/** カラーフィールド(値は "#rrggbb")。 */
export function ColorField({ name, label, description, required, className }: BaseFieldProps) {
  return (
    <FormField name={name} label={label} description={description} required={required} className={className}>
      {(field) => (
        <ColorPicker value={(field.value as string) ?? "#0f766e"} onChange={(c) => field.onChange(c)} />
      )}
    </FormField>
  );
}

/** ラジオフィールド。options を縦に並べる。 */
export function RadioField({
  name, label, description, required, className, options,
}: BaseFieldProps & { options: { label: string; value: string }[] }) {
  return (
    <FormField name={name} label={label} description={description} required={required} className={className}>
      {(field) => (
        <RadioGroup value={(field.value as string) ?? ""} onValueChange={(v) => field.onChange(v)}>
          {options.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-fg)]">
              <RadioGroupItem value={o.value} />
              {o.label}
            </label>
          ))}
        </RadioGroup>
      )}
    </FormField>
  );
}

// ---- 追加フィールド(評価・タグ・OTP・サジェスト) ----
import { Rating, TagInput, OTPInput, Autocomplete } from "@platform/ui";

/** 星評価フィールド。 */
export function RatingField({ name, label, description, required, className }: BaseFieldProps) {
  return (
    <FormField name={name} label={label} description={description} required={required} className={className}>
      {(field) => <Rating value={(field.value as number) ?? 0} onChange={(v) => field.onChange(v)} />}
    </FormField>
  );
}

/** タグ入力フィールド(値は string[])。 */
export function TagsField({ name, label, description, required, className, placeholder }: BaseFieldProps & { placeholder?: string }) {
  return (
    <FormField name={name} label={label} description={description} required={required} className={className}>
      {(field) => <TagInput value={(field.value as string[]) ?? []} onChange={(t) => field.onChange(t)} placeholder={placeholder} />}
    </FormField>
  );
}

/** OTP(ワンタイムコード)フィールド。 */
export function OtpField({ name, label, description, required, className, length }: BaseFieldProps & { length?: number }) {
  return (
    <FormField name={name} label={label} description={description} required={required} className={className}>
      {(field) => <OTPInput length={length} value={(field.value as string) ?? ""} onChange={(v) => field.onChange(v)} />}
    </FormField>
  );
}

/** サジェスト付き入力フィールド。 */
export function AutocompleteField({
  name, label, description, required, className, suggestions, placeholder,
}: BaseFieldProps & { suggestions: string[]; placeholder?: string }) {
  return (
    <FormField name={name} label={label} description={description} required={required} className={className}>
      {(field) => (
        <Autocomplete value={(field.value as string) ?? ""} onChange={(v) => field.onChange(v)} suggestions={suggestions} placeholder={placeholder} />
      )}
    </FormField>
  );
}

// ---- 音声入力フィールド ----
import { VoiceInput } from "@platform/ui";

/** 音声入力フィールド(マイクで口述→テキスト)。 */
export function VoiceField({
  name, label, description, required, className, placeholder, multiline,
}: BaseFieldProps & { placeholder?: string; multiline?: boolean }) {
  return (
    <FormField name={name} label={label} description={description} required={required} className={className}>
      {(field) => (
        <VoiceInput value={(field.value as string) ?? ""} onChange={(v) => field.onChange(v)} placeholder={placeholder} multiline={multiline} />
      )}
    </FormField>
  );
}
