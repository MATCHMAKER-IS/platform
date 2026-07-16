/**
 * 多段(ステップ)フォームのロジック(純ロジック)。
 * ステップごとのフィールド割り当て・進捗・遷移可否を扱う。条件付き表示と組み合わせられる。
 * @packageDocumentation
 */
import { type FormField, visibleFields } from "./field.js";

/** フォームの 1 ステップ。 */
export interface FormStep {
  /** ステップ ID。 */
  id: string;
  /** タイトル。 */
  title: string;
  /** このステップに含まれるフィールド名。 */
  fields: string[];
}

/**
 * 指定したステップの、今表示されるフィールドを返す。
 *
 * @param fields フィールド定義の配列
 * @param step ステップ番号
 * @param values 現在の入力値
 * @returns そのステップで表示するフィールド
 */
export function stepVisibleFields(step: FormStep, allFields: FormField[], values: Record<string, unknown>): FormField[] {
  const inStep = new Set(step.fields);
  return visibleFields(allFields.filter((f) => inStep.has(f.name)), values);
}

/** 進捗情報。 */
export interface StepProgress {
  /** 現在のステップ番号(0 起点)。 */
  index: number;
  /** 総ステップ数。 */
  total: number;
  /** 最初のステップか。 */
  isFirst: boolean;
  /** 最後のステップか。 */
  isLast: boolean;
  /** 進捗率(0..1)。 */
  ratio: number;
}

/**
 * ステップの進捗を求める(プログレスバー用)。
 *
 * @param current 現在のステップ
 * @param total 全ステップ数
 * @returns 現在位置・全体・割合(0〜1)
 */
export function stepProgress(index: number, total: number): StepProgress {
  const clamped = Math.max(0, Math.min(index, total - 1));
  return {
    index: clamped,
    total,
    isFirst: clamped === 0,
    isLast: clamped === total - 1,
    ratio: total > 0 ? (clamped + 1) / total : 0,
  };
}

/**
 * 次のステップ番号を返す。
 *
 * @param current 現在のステップ
 * @param total 全ステップ数
 * @returns 次の番号。**最後なら据え置き**(範囲外に飛ばさない)
 */
export function nextStep(index: number, total: number): number {
  return Math.min(index + 1, total - 1);
}

/**
 * 前のステップ番号を返す。
 *
 * @param current 現在のステップ
 * @returns 前の番号。**最初なら据え置き**(負にしない)
 */
export function prevStep(index: number): number {
  return Math.max(index - 1, 0);
}

/**
 * ステップ内の必須フィールドがすべて入力済みか(表示中のもののみ対象)。
 * バリデーションの詳細は zod スキーマに委ね、ここは「必須の空欄が無いか」の簡易判定。
 *
 * @param fields フィールド定義の配列
 * @param step ステップ番号
 * @param values 入力値
 * @returns そのステップの必須項目がすべて埋まっていれば true(**次へ進めるかの判定**)
 */
export function isStepFilled(step: FormStep, allFields: FormField[], values: Record<string, unknown>): boolean {
  return stepVisibleFields(step, allFields, values)
    .filter((f) => f.required)
    .every((f) => {
      const v = values[f.name];
      return v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
    });
}
