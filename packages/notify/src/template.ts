/**
 * 通知テンプレート。`{{var}}` を変数で置換する軽量テンプレート。
 * @packageDocumentation
 */

/** `{{key}}` を values で置換する(未定義キーは空文字)。 */
export function renderTemplate(template: string, values: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    const v = key.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), values);
    return v == null ? "" : String(v);
  });
}
