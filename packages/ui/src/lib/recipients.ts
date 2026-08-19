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
 * 送信できるメール形式。**`@platform/mail` の `EMAIL_RE` と同じもの**。
 *
 * 依存を張らずに複製しているので、**片方を変えたらもう片方も変えること**
 * (smoke が一致を見張る)。
 */
const EMAIL_RE = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

/**
 * 宛先の形式を、**`@platform/mail` が送信時に使うのと同じ基準**で判定する。
 *
 * **画面と送信で基準がずれると直しようがない。** 2026-08 まで
 * `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` という緩い判定で、画面では「有効」なのに
 * 送信時に弾かれるものが 4 通りあった——**254 文字超**(宛先が長いだけで
 * 保存後に送れず、通知が届かないのに画面はエラーを出さない)、
 * `日本語@例.jp`、`a@b..jp`、`.a@b.jp`。
 *
 * **完全な検証はできない**(RFC 5322 は複雑すぎるし、送ってみるまで届くか分からない)。
 * ここは「送信時に確実に弾かれるもの」を画面で先に止めるためのもの。
 *
 * `@platform/mail` に依存を張らず同じ式を持つのは、`ui` を軽く保つため。
 * **片方だけ変えると画面と送信がずれる**ので、smoke が一致を見張っている。
 *
 * @param s メールアドレス
 * @returns 送信できる形式なら true
 */
export function isValidEmail(s: string): boolean {
  const e = s.trim();
  return e.length <= 254 && EMAIL_RE.test(e);
}

/**
 * 宛先を更新または追加する。
 *
 * @param list 現在の宛先
 * @param r 保存する宛先
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
 * @param list 現在の宛先
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
 * @param list 宛先の配列
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
 * @param list 宛先の配列
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
