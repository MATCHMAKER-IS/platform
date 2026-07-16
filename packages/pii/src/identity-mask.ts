/**
 * 本人確認番号のマスキング(番号法・犯収法を意識した安全表示)。
 * 画面表示・ログ・監査で「本人が確認できる最小限」だけ見せ、残りを伏字にする。
 * マスキングは表示用であり、保存はフィールド暗号(createFieldCipher)を併用すること。
 * @packageDocumentation
 */

/**
 * マイナンバー(個人番号 12 桁)をマスクする。
 * 番号法上、収集・表示は必要最小限に限られる。既定は全桁伏字(下 `visible` 桁のみ表示)。
 * @param value 個人番号(ハイフン・空白は無視)
 * @param visible 末尾に残す桁数(既定 0 = 全桁マスク)
 * @returns マスクしたマイナンバー(**下 4 桁のみ**。マイナンバーは法律で扱いが厳しく、原則ログに残さない)
 */
export function maskMyNumber(value: string, visible = 0): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 12) {
    // 想定外の長さでも安全側(全桁マスク)
    return "*".repeat(Math.max(0, digits.length));
  }
  if (visible <= 0) return "************";
  const keep = Math.min(visible, 4); // 表示は最大4桁までに制限
  return "*".repeat(12 - keep) + digits.slice(-keep);
}

/**
 * 本人確認書類番号を汎用マスクする(末尾数桁のみ表示)。
 * 運転免許証・在留カード・パスポート等に使える。
 * @param value 書類番号
 * @param visible 末尾に残す文字数(既定 4)
 * @returns マスクした番号(**末尾のみ残す**)
 */
export function maskIdentityNumber(value: string, visible = 4): string {
  const v = value.replace(/[\s\-]/g, "");
  if (v.length <= visible) return "*".repeat(v.length);
  return "*".repeat(v.length - visible) + v.slice(-visible);
}
