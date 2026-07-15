"use client";
/** CMS 内のセクション切り替えナビ。 */
import * as React from "react";

const LINKS = [
  { href: "/cms/dashboard", label: "ダッシュボード" },
  { href: "/cms", label: "記事" },
  { href: "/cms/pages", label: "固定ページ" },
  { href: "/cms/announcements", label: "お知らせ" },
  { href: "/cms/categories", label: "カテゴリ・タグ" },
  { href: "/cms/media", label: "メディア" },
  { href: "/cms/publish-requests", label: "公開申請" },
  { href: "/cms/history", label: "操作履歴" },
];

export function CmsNav({ active }: { active: string }) {
  return (
    <nav className="mx-auto flex max-w-4xl gap-2 border-b border-neutral-200 px-6 py-3">
      {LINKS.map((l) => (
        <a key={l.href} href={l.href} className={l.href === active ? "rounded bg-neutral-900 px-3 py-1 text-sm text-white" : "rounded px-3 py-1 text-sm hover:bg-neutral-100"}>
          {l.label}
        </a>
      ))}
    </nav>
  );
}
