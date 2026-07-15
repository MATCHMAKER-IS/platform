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

/** 簡易メール形式チェック。 */
export function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

/** id が一致すれば更新、無ければ追加した新配列を返す。 */
export function upsertRecipient(list: Recipient[], r: Recipient): Recipient[] {
  const i = list.findIndex((x) => x.id === r.id);
  if (i >= 0) { const c = [...list]; c[i] = r; return c; }
  return [...list, r];
}

/** id の宛先を除いた新配列を返す。 */
export function removeRecipient(list: Recipient[], id: string): Recipient[] {
  return list.filter((x) => x.id !== id);
}

/** 有効な宛先のみ(メール形式が正しいもの)。 */
export function validRecipients(list: Recipient[]): Recipient[] {
  return list.filter((r) => isValidEmail(r.email));
}

/** 宛先を CSV 行(見出し日本語)に変換する。 */
export function recipientsToRows(list: Recipient[]): Record<string, string>[] {
  return list.map((r) => ({ 氏名: r.name, メール: r.email, ロール: r.role ?? "", SlackID: r.slackId ?? "" }));
}

/** CSV 由来の行から宛先を復元する(id は付番。メール不正は除外)。 */
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
