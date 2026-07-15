/**
 * 明細への既定消費税率の適用。税率が未指定(undefined)の明細に、システム設定の既定税率を補う。純粋関数のみ。
 * @packageDocumentation
 */

/** 税率を持ちうる明細（他のフィールドは保持）。 */
export type RatedLine = { taxRate?: number } & Record<string, unknown>;

/** taxRate が未指定の明細に既定税率を補って返す（指定済みはそのまま）。 */
export function applyDefaultTaxRate<T extends RatedLine>(lines: T[], defaultRate: number): T[] {
  return lines.map((l) => (l.taxRate === undefined ? { ...l, taxRate: defaultRate } : l));
}
