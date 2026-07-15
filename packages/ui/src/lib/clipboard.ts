/**
 * クリップボード操作(コピー/貼り付け)。
 * navigator.clipboard を使い、テスト用に writer/reader を注入できる。
 * @packageDocumentation
 */

/** テキストをクリップボードにコピーする。成功で true。 */
export async function copyToClipboard(text: string, writer?: (t: string) => Promise<void>): Promise<boolean> {
  try {
    if (writer) {
      await writer(text);
      return true;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** クリップボードからテキストを読む。失敗で null。 */
export async function readClipboard(reader?: () => Promise<string>): Promise<string | null> {
  try {
    if (reader) return await reader();
    if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
      return await navigator.clipboard.readText();
    }
    return null;
  } catch {
    return null;
  }
}
