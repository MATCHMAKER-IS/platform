"use client";
/** ブログのサイドバー。カテゴリ一覧（件数つき）＋バナー広告枠。 */
import * as React from "react";
import { BannerAd } from "@platform/ui";

interface CatItem { id: string; name: string; slug: string; count: number }
interface BannerItem { id: string; image: string; href: string; alt?: string; sponsored?: boolean }

export function SiteSidebar({ categories, banner }: { categories: CatItem[]; banner?: BannerItem }) {
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="mb-2 text-sm font-semibold">カテゴリ</h3>
        <ul className="flex flex-col gap-1 text-sm">
          {categories.map((c) => (
            <li key={c.id}>
              <a href={`/blog/category/${c.slug}`} className="flex items-center justify-between hover:text-blue-600">
                <span>{c.name}</span>
                <span className="text-xs text-neutral-500">{c.count}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
      {banner && (
        <section>
          <h3 className="mb-2 text-xs font-semibold text-neutral-400">スポンサー</h3>
          <BannerAd image={banner.image} href={banner.href} alt={banner.alt} sponsored={banner.sponsored} />
        </section>
      )}
    </div>
  );
}
