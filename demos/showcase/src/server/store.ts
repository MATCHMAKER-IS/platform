/**
 * デモ用のインメモリ保持と基盤部品の初期化。
 * ロジック(データ保持)はデモ側に置き、共通機能は @platform/* を呼ぶ、という
 * 基盤/アプリの分担を示す。DB を使わないので `pnpm dev` だけで動く。
 */
import { createMailer, createMemoryTransport } from "@platform/mail";
import { definePolicy } from "@platform/auth";

/** 問い合わせ 1 件(デモのドメインモデル)。 */
export interface Inquiry {
  id: string;
  name: string;
  email: string;
  message: string;
  /** 受付日時(UTC 保存、表示は JST)。 */
  createdAt: string;
}

// プロセス内で共有するインメモリストア(デモ用)。
const inquiries: Inquiry[] = [];

/** メール送信はメモリ Transport(送信内容を記録するだけ)。 */
export const mailMemory = createMemoryTransport();
export const mailer = createMailer({ transport: mailMemory, defaultFrom: "no-reply@example.co.jp" });

/** RBAC ポリシー(デモ用)。 */
export const policy = definePolicy({
  admin: ["inquiry:read", "inquiry:export"],
  staff: ["inquiry:read"],
});

export function listInquiries(): Inquiry[] {
  return [...inquiries].reverse(); // 新しい順
}

export function addInquiry(i: Inquiry): void {
  inquiries.push(i);
}
