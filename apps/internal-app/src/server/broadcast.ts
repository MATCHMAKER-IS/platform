/**
 * 全体周知（お知らせ配信）。ユーザーディレクトリの有効な利用者に、受信箱経由で一斉配信する。純粋な組み立てのみ。
 * @packageDocumentation
 */
import { type User } from "./user-repo.js";

/** 配信対象（有効な利用者のメールアドレス）。 */
export function activeRecipients(users: User[]): string[] {
  return users.filter((u) => u.active).map((u) => u.email);
}
