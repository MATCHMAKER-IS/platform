/**
 * 配信宛先の管理ロジック(純関数)。月次レポート等の送り先を追加/更新/削除する。
 * @packageDocumentation
 */

/** 配信宛先。 */
export interface Recipient {
  id: string;
  name: string;
  email: string;
  /** 対応する承認ロール等(任意)。 */
  role?: string;
  /** 通知チャネル。 */
  channels?: ("email" | "slack")[];
  slackId?: string;
}

/**
 * メール形式を簡易チェックする。
 *
 * **完全な検証はできない**(RFC 5322 は複雑すぎる)。**送ってみるまで届くか分からない**ので、
 * ここでは明らかな誤りだけを弾く。厳密にやりたいなら `@platform/validation` を使う。
 *
 * @param email メールアドレス
 * @returns 形式が妥当そうなら true
 */
export function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

/**
 * 宛先を更新または追加する。
 *
 * @param recipients 現在の宛先
 * @param recipient 保存する宛先
 * @returns 更新した新しい配列
 */
export function upsertRecipient(list: Recipient[], r: Recipient): Recipient[] {
  const i = list.findIndex((x) => x.id === r.id);
  if (i >= 0) { const c = [...list]; c[i] = r; return c; }
  return [...list, r];
}

/**
 * 宛先を削除する。
 *
 * @param recipients 現在の宛先
 * @param id 削除する id
 * @returns 削除した新しい配列
 */
export function removeRecipient(list: Recipient[], id: string): Recipient[] {
  return list.filter((x) => x.id !== id);
}

/**
 * 有効な宛先だけを返す。
 *
 * **送信の前に通す**(形式が不正なアドレスに送ると、バウンスして送信者の評判が落ちる)。
 *
 * @param recipients 宛先の配列
 * @returns メール形式が妥当な宛先
 */
export function validRecipients(list: Recipient[]): Recipient[] {
  return list.filter((r) => isValidEmail(r.email));
}

/**
 * 宛先を CSV 行にする(見出しは日本語)。
 *
 * **Excel で編集して戻せる**ようにするため。
 *
 * @param recipients 宛先の配列
 * @returns CSV の行(オブジェクトの配列)
 */
export function recipientsToRows(list: Recipient[]): Record<string, string>[] {
  return list.map((r) => ({ 氏名: r.name, メール: r.email, ロール: r.role ?? "", SlackID: r.slackId ?? "" }));
}

/**
 * CSV から宛先を復元する。
 *
 * **メール形式が不正な行は除外**する(エラーにせず、使える分だけ取り込む)。
 * id は連番で振り直す。
 *
 * @param rows CSV の行
 * @returns 宛先の配列
 */
export function recipientsFromRows(rows: Record<string, string>[]): Recipient[] {
  return rows
    .map((row, i) => ({
      id: `imported-${i + 1}`,
      name: (row["氏名"] ?? row["name"] ?? "").trim(),
      email: (row["メール"] ?? row["email"] ?? "").trim(),
      role: (row["ロール"] ?? row["role"] ?? "").trim() || undefined,
      slackId: (row["SlackID"] ?? row["slackId"] ?? "").trim() || undefined,
      channels: ["email" as const],
    }))
    .filter((r) => r.name !== "" && isValidEmail(r.email));
}
