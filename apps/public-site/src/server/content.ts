/** サンプルの公開サイトコンテンツ（本番は CMS/DB に置き換え）。 */
import { createMemorySiteContent, type BlogPost } from "./site-content.js";
import { type Page, type MenuItem, type Announcement, type Banner } from "@platform/site";
import { type Category } from "@platform/board";
import { liveBlogViews, livePageViews, type CmsPost, type ManagedPage } from "@platform/cms";

const pages: Page[] = [
  { slug: "", title: "ホーム", blocks: [
    { id: "h1", type: "heading", data: { level: 1, text: "ようこそ" } },
    { id: "t1", type: "text", data: { text: "これは公開サイト基盤のサンプルです。\n詳しくは https://example.com をご覧ください。" } },
    { id: "c1", type: "cta", data: { label: "会社概要を見る", href: "/about" } },
  ] },
  { slug: "about", title: "会社概要", blocks: [
    { id: "h2", type: "heading", data: { level: 1, text: "会社概要" } },
    { id: "t2", type: "text", data: { text: "私たちは社内基盤と公開サイト基盤を内製しています。" } },
    { id: "l2", type: "list", data: { items: ["設立: 2020年", "所在地: 東京", "事業: ソフトウェア開発"] } },
  ] },
];

const menu: MenuItem[] = [
  { label: "ホーム", href: "/" },
  { label: "会社概要", href: "/about" },
  { label: "ブログ", href: "/blog", children: [
    { label: "すべて", href: "/blog" },
    { label: "技術", href: "/blog/category/tech" },
    { label: "生活", href: "/blog/category/life" },
  ] },
];

const announcements: Announcement[] = [
  { id: "welcome", message: "サイトをリニューアルしました。", level: "info", startAt: "2025-01-01T00:00:00Z" },
];

const categories: Category[] = [
  { id: "tech", name: "技術", slug: "tech", order: 1 },
  { id: "frontend", name: "フロントエンド", slug: "frontend", parentId: "tech", order: 1 },
  { id: "backend", name: "バックエンド", slug: "backend", parentId: "tech", order: 2 },
  { id: "life", name: "生活", slug: "life", order: 2 },
];

const posts: BlogPost[] = [
  { slug: "nextjs-app-router", title: "Next.js App Router 入門", categoryId: "frontend", eyecatch: "https://picsum.photos/seed/next/1200/600", excerpt: "App Router の基本を解説します。", body: "App Router ではディレクトリ構成がそのままルートになります。\nサーバーコンポーネントが既定で、必要なところだけ 'use client' にします。", publishedAt: "2025-07-05T09:00:00Z", tags: ["Next.js", "React"] },
  { slug: "postgres-index", title: "PostgreSQL インデックス設計", categoryId: "backend", eyecatch: "https://picsum.photos/seed/pg/1200/600", excerpt: "インデックスの基本と落とし穴。", body: "適切なインデックスはクエリを劇的に速くします。\n一方で書き込みコストとのトレードオフに注意が必要です。", publishedAt: "2025-06-20T09:00:00Z", tags: ["PostgreSQL"] },
  { slug: "morning-coffee", title: "朝のコーヒーの淹れ方", categoryId: "life", eyecatch: "https://picsum.photos/seed/coffee/1200/600", excerpt: "豆と湯温の話。", body: "豆は挽きたてが一番です。\n湯温は 90 度前後がおすすめです。", publishedAt: "2025-05-15T09:00:00Z", tags: ["コーヒー"] },
];

// CMS 由来の記事（本番は internal-app と同じ DB を @platform/cms 経由で参照）。
// 下書き・予約公開・公開が混在していても、公開中のものだけがサイトに出る。
const cmsPosts: CmsPost[] = [
  { slug: "cms-published", title: "CMS から公開した記事", categoryId: "tech", eyecatch: "https://picsum.photos/seed/cms1/1200/600", excerpt: "CMS で作成・公開した記事です。", body: "この記事は社内 CMS から公開されました。\n編集すると即座にサイトへ反映されます。", tags: ["CMS"], status: "published", publishedAt: "2025-07-08T09:00:00Z", updatedAt: "2025-07-08T09:00:00Z" },
  { slug: "cms-draft", title: "下書き（表示されない）", body: "これは下書きなのでサイトには出ません。", tags: [], status: "draft", updatedAt: "2025-07-09T09:00:00Z" },
  { slug: "cms-scheduled", title: "予約公開（時刻まで非表示）", body: "未来の日時に公開予約された記事です。", tags: [], status: "published", publishedAt: "2099-01-01T00:00:00Z", updatedAt: "2025-07-09T09:00:00Z" },
];

const banners: Banner[] = [
  { id: "promo", image: "https://picsum.photos/seed/ad1/300/250", href: "https://example.com/promo", alt: "キャンペーン", slot: "sidebar", weight: 2, sponsored: true, startAt: "2025-01-01T00:00:00Z" },
  { id: "recruit", image: "https://picsum.photos/seed/ad2/300/250", href: "/recruit", alt: "採用情報", slot: "sidebar", weight: 1 },
];

// CMS 由来の固定ページ（公開中のみサイトに反映）。
const managedPages: ManagedPage[] = [
  { slug: "recruit", title: "採用情報", status: "published", updatedAt: "2025-07-10T09:00:00Z", blocks: [
    { id: "rh", type: "heading", data: { level: 1, text: "採用情報" } },
    { id: "rt", type: "text", data: { text: "一緒に社内基盤をつくる仲間を募集しています。" } },
    { id: "rc", type: "cta", data: { label: "応募する", href: "/contact" } },
  ] },
  { slug: "draft-page", title: "下書きページ（非表示）", status: "draft", updatedAt: "2025-07-10T09:00:00Z", blocks: [] },
];

// CMS 由来のお知らせ（本番は同一 DB を参照）。
const managedAnnouncements: Announcement[] = [
  { id: "maint", message: "7/20 深夜にメンテナンスを実施します。", level: "warning", startAt: "2025-07-01T00:00:00Z", endAt: "2025-07-21T00:00:00Z" },
];

// CMS 由来のカテゴリ（本番は同一 DB を参照）。既存のコード定義カテゴリと合流。
const managedCategories: Category[] = [
  { id: "news", name: "お知らせ", slug: "news", order: 3 },
];

export const siteConfig = { siteName: "サンプル社", baseUrl: "https://sample.example.com", copyrightHolder: "サンプル社", copyrightStartYear: 2020 };
// 手書きの posts に、CMS 由来の公開中記事（liveBlogViews で下書き/予約を除外）を合流。
const cmsBlogPosts: BlogPost[] = liveBlogViews(cmsPosts).map((v) => ({ slug: v.slug, title: v.title, body: v.body, publishedAt: v.publishedAt, tags: v.tags, ...(v.categoryId ? { categoryId: v.categoryId } : {}), ...(v.excerpt ? { excerpt: v.excerpt } : {}), ...(v.eyecatch ? { eyecatch: v.eyecatch } : {}) }));

// 公開中の管理ページを Page ビュー化して手書きページと合流。
const managedPageViews = livePageViews(managedPages);

export const content = createMemorySiteContent({
  pages: [...pages, ...managedPageViews],
  menu,
  announcements: [...announcements, ...managedAnnouncements],
  categories: [...categories, ...managedCategories],
  posts: [...posts, ...cmsBlogPosts],
  banners,
});

/** プレビュー用に全ステータスの CMS 記事を公開（本番は同一 DB を参照）。 */
export const cmsPostsForPreview = cmsPosts;
