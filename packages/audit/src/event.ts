/**
 * 監査イベントと変更差分(純ロジック)。「誰が・いつ・何を・どう変えたか」を表す。
 * @packageDocumentation
 */

/** 監査イベント。 */
export interface AuditEvent {
  /** 発生日時(ISO)。 */
  at: string;
  /** 操作者(ユーザーID など)。 */
  actor: string;
  /** 操作(例: "expense.submit", "invoice.issue")。 */
  action: string;
  /** 対象(例: "expense:123")。 */
  target: string;
  /** 変更前の値(任意)。 */
  before?: Record<string, unknown>;
  /** 変更後の値(任意)。 */
  after?: Record<string, unknown>;
  /** 補足メタ(IP・理由など)。 */
  meta?: Record<string, unknown>;
}

/** フィールド単位の変更。 */
export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

/** {@link diffChanges} のオプション。db 版の DiffOptions と揃えている。 */
export interface DiffOptions {
  /** 差分対象から除外するフィールド(例: updatedAt)。 */
  ignore?: string[];
  /** 値をマスクするフィールド(例: password)。変更検知はするが値は "***"。 */
  redact?: string[];
}

/**
 * before/after を比較し、変わったフィールドだけ返す(監査ログ用の配列形式)。
 *
 * DB 行の差分をマップ形式(`Record<string, {before,after}>`)で扱いたい場合は
 * `@platform/db` の diffChanges を使う。こちらは監査イベントに埋め込みやすい配列を返す。
 *
 * @example
 * ```ts
 * diffChanges({ name: "A", pw: "x" }, { name: "B", pw: "y" }, { redact: ["pw"] });
 * // => [{ field: "name", before: "A", after: "B" }, { field: "pw", before: "***", after: "***" }]
 * ```
 *
 * @param before 変更前
 * @param after 変更後
 * @param options.mask マスクするフィールド(**パスワードなどを監査ログに残さない**)
 * @returns 変わったフィールドだけの差分(**変わっていないものは含まない**)
 */
export function diffChanges(
  before: Record<string, unknown> = {},
  after: Record<string, unknown> = {},
  options: DiffOptions = {},
): FieldChange[] {
  const ignore = new Set(options.ignore ?? []);
  const redact = new Set(options.redact ?? []);
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: FieldChange[] = [];
  for (const field of keys) {
    if (ignore.has(field)) continue;
    const b = before[field];
    const a = after[field];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      changes.push(redact.has(field) ? { field, before: "***", after: "***" } : { field, before: b, after: a });
    }
  }
  return changes;
}

/**
 * イベントを人が読める 1 行に要約する。
 *
 * **監査ログは人が読むもの**(機械が読むだけなら JSON でよい)。
 * 調査のときに一覧をざっと見て、怪しいものを見つけられる形にする。
 *
 * @param event 監査イベント
 * @returns 要約(1 行)
 */
export function describeEvent(event: AuditEvent): string {
  const changes = diffChanges(event.before, event.after);
  const changeText = changes.length > 0 ? `(${changes.map((c) => c.field).join(", ")})` : "";
  return `${event.at} ${event.actor} が ${event.target} を ${event.action} ${changeText}`.trim();
}

/**
 * ネストしたオブジェクトを再帰的に比較し、変わった「パス」だけ返す（例 "address.city"）。
 *
 * **どこが変わったかを正確に記録する**ため。オブジェクト全体を before/after で
 * 残すと、監査ログが肥大化し、差分も読めない。
 *
 * @param before 変更前
 * @param after 変更後
 * @param options.mask マスクするパス
 * @returns 変わったパスだけの差分
 * 配列やプリミティブは JSON 比較で葉として扱う。UI での差分の詳細表示に使う。
 */
export function deepDiffChanges(
  before: Record<string, unknown> = {},
  after: Record<string, unknown> = {},
  prefix = "",
): FieldChange[] {
  const changes: FieldChange[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    const path = prefix ? `${prefix}.${key}` : key;
    const b = before[key];
    const a = after[key];
    const bothPlainObjects =
      b !== null && a !== null && typeof b === "object" && typeof a === "object" && !Array.isArray(b) && !Array.isArray(a);
    if (bothPlainObjects) {
      changes.push(...deepDiffChanges(b as Record<string, unknown>, a as Record<string, unknown>, path));
    } else if (JSON.stringify(b) !== JSON.stringify(a)) {
      changes.push({ field: path, before: b, after: a });
    }
  }
  return changes;
}
