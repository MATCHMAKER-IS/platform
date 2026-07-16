/**
 * フィールド定義から zod スキーマを生成する。
 * useZodForm や @platform/validation と組み合わせて、宣言的フォームの検証を自動化する。
 * 非表示フィールドの必須は stripHiddenValues で除外してから検証するとよい。
 * @packageDocumentation
 */
import { z } from "zod";
import type { FormField } from "./field";

/**
 * 1 つのフィールドから zod の型を作る。
 *
 * @param field フィールド定義
 * @returns zod スキーマ(必須・型・最大長などを反映)
 */
export function buildFieldSchema(field: FormField): z.ZodTypeAny {
  let schema: z.ZodTypeAny;
  switch (field.type) {
    case "number": {
      let n = z.number();
      if (field.min !== undefined) n = n.min(field.min);
      if (field.max !== undefined) n = n.max(field.max);
      schema = n;
      break;
    }
    case "checkbox":
      schema = z.boolean();
      break;
    case "email":
      schema = z.string().email();
      break;
    case "url":
      schema = z.string().url();
      break;
    case "select":
    case "radio": {
      const values = (field.options ?? []).map((o) => o.value);
      schema = values.length > 0 ? z.enum(values as [string, ...string[]]) : z.string();
      break;
    }
    default: {
      let str = z.string();
      if (field.min !== undefined) str = str.min(field.min);
      if (field.max !== undefined) str = str.max(field.max);
      schema = str;
    }
  }
  // 必須でなければ optional / 必須の文字列は空文字を弾く
  if (!field.required) return schema.optional();
  if (field.type !== "number" && field.type !== "checkbox" && schema instanceof z.ZodString) {
    return (schema as z.ZodString).min(1, `${field.label}は必須です`);
  }
  return schema;
}

/**
 * フィールド定義から zod のオブジェクトスキーマを組み立てる。
 *
 * **画面の定義と検証を 1 か所にまとめる**ため。別々に書くと必ずズレる
 * (画面では必須なのに検証が通る、など)。
 *
 * @param fields フィールド定義の配列
 * @returns zod スキーマ
 */
export function buildFormSchema(fields: FormField[]): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) shape[f.name] = buildFieldSchema(f);
  return z.object(shape);
}
