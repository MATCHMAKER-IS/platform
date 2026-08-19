"use client";
/**
 * 公開サイトのお問い合わせフォーム。送信は /api/contact 経由で社内の受信一覧へ集約される。
 *
 * **中身は `@platform/ui` の `ContactForm` に移した**(2026-08)。
 * `internal-app` にも同じ項目・同じ作りのフォームがあり、
 * 違うのは**送信先とカテゴリだけ**なのに、二重送信の防止まで書き直されていた。
 */
import { ContactForm } from "@platform/ui";

/** 公開サイトの分類。**社内向けとは違う**(利用者が選ぶ言葉に合わせる)。 */
const CATEGORIES = ["製品について", "お見積り", "採用について", "その他"] as const;

/** お問い合わせフォーム。 */
export function ContactClient() {
  return <ContactForm endpoint="/api/contact" categories={CATEGORIES} />;
}
