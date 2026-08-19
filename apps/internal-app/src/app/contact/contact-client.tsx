"use client";
/**
 * 社内の問い合わせフォーム。送信は /api/inquiries へ。
 *
 * **中身は `@platform/ui` の `ContactForm` に移した**(2026-08)。
 * `public-site` にも同じ項目・同じ作りのフォームがあり、
 * 違うのは**送信先とカテゴリだけ**だった。
 */
import { ContactForm } from "@platform/ui";

/** 社内向けの分類。**公開サイトとは違う**(業務の区分に合わせる)。 */
const CATEGORIES = ["請求・支払", "システム不具合", "アカウント", "その他"] as const;

/** {@link ContactClient} の設定。 */
export interface ContactClientProps {
  /** fetch の差し替え(テスト用)。 */
  fetchImpl?: typeof fetch;
}

/** 問い合わせフォーム。 */
export function ContactClient({ fetchImpl }: ContactClientProps) {
  return (
    <ContactForm
      endpoint="/api/inquiries"
      categories={CATEGORIES}
      {...(fetchImpl !== undefined ? { fetchImpl } : {})}
    />
  );
}
