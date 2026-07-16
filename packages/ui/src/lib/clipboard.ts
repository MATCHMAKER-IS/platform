/**
 * クリップボード操作(コピー/貼り付け)。
 * navigator.clipboard を使い、テスト用に writer/reader を注入できる。
 * @packageDocumentation
 */

/**
 * テキストをクリップボードにコピーする。成功で true。
 *
 *
 * @param text コピーする文字列
 * @param writer 書き込みの実装(テスト注入用)
 * @returns 成功したか。**HTTPS でないと失敗する**(Clipboard API の制約)
 */
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

/**
 * クリップボードからテキストを読む。失敗で null。
 *
 *
 * @param reader 読み込みの実装(テスト注入用)
 * @returns クリップボードの中身。**失敗なら null**(利用者の許可が要る)
 */
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
