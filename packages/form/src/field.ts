/**
 * 動的フォームのフィールド定義(純ロジック)。
 * フィールドを宣言的に記述し、条件付き表示・初期値・表示中フィールドの抽出を行う。
 * React にも zod にも依存しない(スキーマ生成は schema.ts)。
 * @packageDocumentation
 */

/** フィールドの種類。 */
export type FieldType =
  | "text" | "textarea" | "number" | "email" | "tel" | "url"
  | "select" | "radio" | "checkbox" | "date" | "time";

/** 選択肢(select/radio 用)。 */
export interface FieldOption {
  value: string;
  label: string;
}

/** 条件付き表示のルール(いずれか 1 条件)。 */
export interface VisibilityRule {
  /** 参照するフィールド名。 */
  field: string;
  /** その値と等しいとき表示。 */
  equals?: unknown;
  /** その値と異なるとき表示。 */
  notEquals?: unknown;
  /** いずれかに一致するとき表示。 */
  in?: unknown[];
  /** 真値(チェック済み等)のとき表示。 */
  truthy?: boolean;
}

/** フォームフィールドの定義。 */
export interface FormField {
  /** フィールド名(値のキー)。 */
  name: string;
  /** 表示ラベル。 */
  label: string;
  /** 種類。 */
  type: FieldType;
  /** 必須か。 */
  required?: boolean;
  /** プレースホルダ。 */
  placeholder?: string;
  /** 補足説明。 */
  help?: string;
  /** 選択肢(select/radio)。 */
  options?: FieldOption[];
  /** 数値/文字数の下限。 */
  min?: number;
  /** 数値/文字数の上限。 */
  max?: number;
  /** 初期値(未指定なら型に応じた既定)。 */
  defaultValue?: unknown;
  /** 表示条件(複数指定は AND)。 */
  visibleWhen?: VisibilityRule | VisibilityRule[];
}

/** 1 つの表示ルールを評価する。 */
export function evaluateRule(rule: VisibilityRule, values: Record<string, unknown>): boolean {
  const v = values[rule.field];
  if (rule.equals !== undefined && v !== rule.equals) return false;
  if (rule.notEquals !== undefined && v === rule.notEquals) return false;
  if (rule.in !== undefined && !rule.in.includes(v)) return false;
  if (rule.truthy !== undefined && Boolean(v) !== rule.truthy) return false;
  return true;
}

/** フィールドが現在の値のもとで表示されるか(visibleWhen が無ければ常に表示)。 */
export function isFieldVisible(field: FormField, values: Record<string, unknown>): boolean {
  if (!field.visibleWhen) return true;
  const rules = Array.isArray(field.visibleWhen) ? field.visibleWhen : [field.visibleWhen];
  return rules.every((r) => evaluateRule(r, values));
}

/** 表示中のフィールドだけを返す。 */
export function visibleFields(fields: FormField[], values: Record<string, unknown>): FormField[] {
  return fields.filter((f) => isFieldVisible(f, values));
}

/** 型に応じたフィールドの既定値。 */
export function fieldDefaultValue(field: FormField): unknown {
  if (field.defaultValue !== undefined) return field.defaultValue;
  switch (field.type) {
    case "checkbox": return false;
    case "number": return undefined;
    case "select": case "radio": return field.options?.[0]?.value ?? "";
    default: return "";
  }
}

/** 全フィールドの初期値オブジェクトを作る。 */
export function defaultValues(fields: FormField[]): Record<string, unknown> {
  return fields.reduce<Record<string, unknown>>((acc, f) => { acc[f.name] = fieldDefaultValue(f); return acc; }, {});
}

/**
 * 非表示フィールドの値を除いた送信データを作る(条件付きで隠れた項目を送らない)。
 * 隠れた項目の必須検証も自然に回避できる。
 */
export function stripHiddenValues(fields: FormField[], values: Record<string, unknown>): Record<string, unknown> {
  const visible = new Set(visibleFields(fields, values).map((f) => f.name));
  return Object.fromEntries(Object.entries(values).filter(([k]) => visible.has(k)));
}
