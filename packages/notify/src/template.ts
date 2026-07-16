/**
 * 通知テンプレート。`{{var}}` を変数で置換する軽量テンプレート。
 * @packageDocumentation
 */

/**
 * `{{key}}` を置換する。
 *
 * **未定義のキーは空文字**(`{{name}}` がそのまま出るより、空の方がまし)。
 * ただし置換漏れに気づきにくいので、テンプレートは検証してから使うこと。
 *
 * @param template テンプレート
 * @param values 置換する値
 * @returns 置換した文字列
 */
export function renderTemplate(template: string, values: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    const v = key.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), values);
    return v == null ? "" : String(v);
  });
}
