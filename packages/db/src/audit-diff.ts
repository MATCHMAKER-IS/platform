/**
 * 変更差分の計算(純関数)。監査ログに「何がどう変わったか」を残すために使う。
 * @packageDocumentation
 */

/** 1 フィールドの変更前後。 */
export interface FieldChange {
  before: unknown;
  after: unknown;
}

/** {@link diffChanges} のオプション。 */
export interface DiffOptions {
  /** 差分対象から除外するフィールド(例: updatedAt)。 */
  ignore?: string[];
  /** 値をマスクするフィールド(例: password)。変更検知はするが値は "***"。 */
  redact?: string[];
}

function stableEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * 変更前後のオブジェクトを比較し、変わったフィールドだけを返す。
 * @returns `{ field: { before, after } }`(変更が無ければ空オブジェクト)
 *
 * @example
 * ```ts
 * diffChanges({ name: "A", age: 20 }, { name: "B", age: 20 });
 * // => { name: { before: "A", after: "B" } }
 * ```
 */
export function diffChanges(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  options: DiffOptions = {},
): Record<string, FieldChange> {
  const ignore = new Set(options.ignore ?? []);
  const redact = new Set(options.redact ?? []);
  const b = before ?? {};
  const a = after ?? {};
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const out: Record<string, FieldChange> = {};
  for (const key of keys) {
    if (ignore.has(key)) continue;
    if (!stableEqual(b[key], a[key])) {
      out[key] = redact.has(key) ? { before: "***", after: "***" } : { before: b[key], after: a[key] };
    }
  }
  return out;
}

/** 差分があるか。 */
export function hasChanges(diff: Record<string, FieldChange>): boolean {
  return Object.keys(diff).length > 0;
}
