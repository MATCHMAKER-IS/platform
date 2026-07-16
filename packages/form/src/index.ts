/**
 * `@platform/form` — フォーム統合(react-hook-form + zod + @platform/ui)。
 *
 * zod スキーマ(`@platform/validation` の部品で組む)を渡すだけで、型安全な
 * フォームと、ラベル・エラー付きの入力部品が使える。検証・UI・状態管理の
 * 三者を 1 か所で束ね、フォーム開発の定型を無くす。
 *
 * @packageDocumentation
 */
export { useZodForm } from "./use-zod-form";
export { Form, FormField, type FormProps, type FormFieldProps, type FieldRenderProps } from "./form";
export { readCsrfToken, useCsrfToken, csrfHeaders, CsrfField } from "./csrf";
export {
  HoneypotField, isHoneypotFilled, SubmitButton,
  useUnsavedChangesWarning, applyServerErrors, useFormAutosave,
} from "./form-helpers";
export {
  TextField, PasswordField, TextareaField, SelectField, ComboboxField, CheckboxField, SwitchField,
  NumberField, DateField, TimeField, ColorField, RadioField,
  RatingField, TagsField, OtpField, AutocompleteField, VoiceField,
} from "./fields";
export * from "./field";
export * from "./steps";
export * from "./schema";
export * from "./flow";
export * from "./review";
export { useSubmitFlow, type UseSubmitFlow } from "./use-submit-flow";
export * from "./errors";
