/**
 * 確認画面・詳細画面の項目生成(純ロジック)。
 * フィールド定義と値から「ラベル: 表示値」の一覧を作る。確認画面(入力の見直し)と
 * 詳細画面(レコード表示)で共通に使える。選択肢はラベルに、真偽は はい/いいえ に整形する。
 * @packageDocumentation
 */
import { type FormField, visibleFields } from "./field.js";

/** 表示項目(ラベルと整形済みの値)。 */
export interface ReviewItem {
  /** フィールド名。 */
  name: string;
  /** ラベル。 */
  label: string;
  /** 表示用の値(整形済み文字列)。 */
  value: string;
}

/** 空値の表示。 */
const EMPTY_DISPLAY = "—";

/** フィールドの値を表示用文字列に整形する(選択肢→ラベル、真偽→はい/いいえ 等)。 */
export function formatFieldValue(field: FormField, value: unknown): string {
  if (value === null || value === undefined || value === "") return EMPTY_DISPLAY;
  if (field.type === "checkbox") return value ? "はい" : "いいえ";
  if ((field.type === "select" || field.type === "radio") && field.options) {
    return field.options.find((o) => o.value === value)?.label ?? String(value);
  }
  if (Array.isArray(value)) return value.length > 0 ? value.join("、") : EMPTY_DISPLAY;
  return String(value);
}

/**
 * 確認画面の項目一覧を作る(現在の値で表示されるフィールドのみ)。
 * 入力 → 確認 の確認画面で、入力内容を「ラベル: 値」で見直せるようにする。
 */
export function reviewItems(fields: FormField[], values: Record<string, unknown>): ReviewItem[] {
  return visibleFields(fields, values).map((f) => ({
    name: f.name,
    label: f.label,
    value: formatFieldValue(f, values[f.name]),
  }));
}

/**
 * 詳細画面の項目一覧を作る(全フィールドを対象。表示条件は無視して定義順に並べる)。
 * レコードを description-list 等で表示するのに使う。
 */
export function describeRecord(fields: FormField[], record: Record<string, unknown>): ReviewItem[] {
  return fields.map((f) => ({
    name: f.name,
    label: f.label,
    value: formatFieldValue(f, record[f.name]),
  }));
}
