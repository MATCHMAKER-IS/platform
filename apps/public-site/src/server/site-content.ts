/**
 * 公開サイトのコンテンツ（ページ・メニュー・お知らせ）と、ブロックの安全な描画モデル。
 * 既定インメモリ。本文テキストは @platform/html でエスケープ＋リンク化して XSS 安全にする。
 * @packageDocumentation
 */
import { visibleBlocks, activeAnnouncements, activeBanners, rotateBanner, type Page, type PageBlock, type MenuItem, type Announcement, type Banner } from "@platform/site";
import { embedIframe, embedHtml } from "@platform/html";
import { categoryTree, filterByCategory, countByCategory, categoryPath, findCategoryBySlug, adjacentPosts, relatedPosts, allTags, postsByTag, type Category, type CategoryNode } from "@platform/board";
import { createSearch, createBm25Index, type Search } from "@platform/search";
import { linkify, nl2br, escapeHtml } from "@platform/html";

/** 描画用に正規化したブロック。text 系は安全な HTML を持つ。 */
export type RenderedBlock =
  | { kind: "heading"; level: number; text: string }
  | { kind: "text"; html: string }
  | { kind: "image"; src: string; alt: string }
  | { kind: "list"; items: string[] }
  | { kind: "cta"; label: string; href: string }
  | { kind: "gallery"; images: { src: string; alt: string; caption?: string }[] }
  | { kind: "embed"; html: string }
  | { kind: "unknown"; type: string };

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

/** 1 ブロックを描画モデルに変換する（テキストは安全な HTML 化）。 */
export function renderBlock(block: PageBlock): RenderedBlock {
  const d = block.data;
  switch (block.type) {
    case "heading":
      return { kind: "heading", level: typeof d.level === "number" ? d.level : 2, text: asString(d.text) };
    case "text":
      // 段落テキスト: linkify がエスケープ＋URLリンク化し、その後 nl2br で改行を <br> に（二重エスケープを避ける）
      return { kind: "text", html: nl2br(linkify(asString(d.text))) };
    case "image":
      return { kind: "image", src: asString(d.src), alt: asString(d.alt) };
    case "list":
      return { kind: "list", items: Array.isArray(d.items) ? d.items.map((i) => asString(i)) : [] };
    case "cta":
      return { kind: "cta", label: asString(d.label, "詳しく見る"), href: asString(d.href, "#") };
    case "gallery": {
      const raw = Array.isArray(d.images) ? d.images : [];
      const images = raw.map((it) => {
        const obj = (it ?? {}) as Record<string, unknown>;
        const img: { src: string; alt: string; caption?: string } = { src: asString(obj.src), alt: asString(obj.alt) };
        if (typeof obj.caption === "string") img.caption = obj.caption;
        return img;
      }).filter((i) => i.src.length > 0);
      return { kind: "gallery", images };
    }
    case "embed": {
      // 信頼済みの埋め込み（管理者が入力）。iframe URL 指定なら iframe を組み立て、raw HTML ならそのまま。
      const src = asString(d.src);
      if (src) return { kind: "embed", html: embedIframe(src, { title: asString(d.title) || undefined, ...(typeof d.height === "number" ? { height: d.height } : {}) }) };
      return { kind: "embed", html: embedHtml(asString(d.html)) };
    }
    default:
      return { kind: "unknown", type: block.type };
  }
}

/** ページの表示対象ブロックを描画モデルの配列にする。 */
export function renderPage(page: Page, now: Date = new Date()): RenderedBlock[] {
  return visibleBlocks(page, now).map(renderBlock);
}

/** コンテンツソース。 */
export interface SiteContent {
  page(slug: string): Promise<Page | undefined>;
  pages(): Promise<Page[]>;
  menu(): Promise<MenuItem[]>;
  announcements(currentPath: string, now?: Date): Promise<Announcement[]>;
  /** サイト内検索（ページ＋記事のタイトル＋本文）。 */
  search(query: string, limit?: number): Promise<SearchResult[]>;
  /** 全記事（公開日時の新しい順）。 */
  posts(): Promise<BlogPost[]>;
  /** slug で記事を引く。 */
  post(slug: string): Promise<BlogPost | undefined>;
  /** カテゴリで記事を絞り込む（既定は子孫含む・新しい順）。 */
  postsByCategory(categoryId: string, options?: { includeDescendants?: boolean }): Promise<BlogPost[]>;
  /** 全カテゴリ。 */
  categories(): Promise<Category[]>;
  /** カテゴリのツリー。 */
  categoryTree(): Promise<CategoryNode[]>;
  /** slug からカテゴリを引く。 */
  categoryBySlug(slug: string): Promise<Category | undefined>;
  /** カテゴリのパンくず。 */
  categoryBreadcrumb(categoryId: string): Promise<Category[]>;
  /** カテゴリ別の記事数。 */
  categoryCounts(): Promise<Record<string, number>>;
  /** 表示対象のバナー（枠・パス）。 */
  banners(currentPath: string, slot?: string): Promise<Banner[]>;
  /** 重み付きで 1 つ選んだバナー。 */
  pickBanner(currentPath: string, slot?: string, random?: () => number): Promise<Banner | null>;
  /** タグ一覧（件数つき・多い順）。 */
  tags(): Promise<{ tag: string; count: number }[]>;
  /** タグで記事を絞り込む（新しい順）。 */
  postsByTag(tag: string): Promise<BlogPost[]>;
  /** 記事の前後（prev=古い / next=新しい）。 */
  adjacent(slug: string): Promise<{ prev?: BlogPost; next?: BlogPost }>;
  /** 関連記事（タグ・カテゴリの近さ順）。 */
  related(slug: string, limit?: number): Promise<BlogPost[]>;
}

/** 検索結果。 */
export interface SearchResult {
  /** "page" か "post"。 */
  kind: "page" | "post";
  slug: string;
  title: string;
  score: number;
  snippet: string;
}

/** ブログ記事。 */
export interface BlogPost {
  slug: string;
  title: string;
  /** カテゴリ ID。 */
  categoryId?: string;
  /** 抜粋（一覧・meta 用）。 */
  excerpt?: string;
  /** アイキャッチ画像。 */
  eyecatch?: string;
  /** 本文（プレーンテキスト or 簡易マークアップ・段落は改行区切り）。 */
  body: string;
  /** 公開日時（ISO）。 */
  publishedAt: string;
  /** タグ。 */
  tags?: string[];
}

/** ページからプレーンテキスト（検索対象）を取り出す。 */
export function pageText(page: Page): string {
  const parts: string[] = [page.title];
  for (const b of page.blocks) {
    if (typeof b.data.text === "string") parts.push(b.data.text);
    if (typeof b.data.heading === "string") parts.push(b.data.heading);
    if (Array.isArray(b.data.items)) parts.push(b.data.items.filter((i): i is string => typeof i === "string").join(" "));
  }
  return parts.join(" ");
}

/** インメモリ実装（seed を渡す）。 */
export function createMemorySiteContent(seed: { pages: Page[]; menu: MenuItem[]; announcements: Announcement[]; categories?: Category[]; posts?: BlogPost[]; banners?: Banner[] }): SiteContent {
  const bySlug = new Map(seed.pages.map((p) => [p.slug, p]));
  const categories = seed.categories ?? [];
  const banners = seed.banners ?? [];
  const postsSorted = (seed.posts ?? []).slice().sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0));
  const postBySlug = new Map(postsSorted.map((p) => [p.slug, p]));
  // 検索インデックス（BM25）。ページと記事をまとめて索引。初回検索時に遅延構築する。
  const index: Search = createSearch(createBm25Index());
  let indexed: Promise<unknown> | null = null;
  const ensureIndexed = () => {
    if (!indexed) {
      const docs = [
        ...seed.pages.map((p) => ({ id: `page:${p.slug}`, text: pageText(p) })),
        ...postsSorted.map((p) => ({ id: `post:${p.slug}`, text: `${p.title} ${p.excerpt ?? ""} ${p.body}` })),
      ];
      indexed = index.index(docs);
    }
    return indexed;
  };
  return {
    async page(slug) {
      return bySlug.get(slug);
    },
    async pages() {
      return [...bySlug.values()];
    },
    async menu() {
      return seed.menu;
    },
    async announcements(currentPath, now = new Date()) {
      return activeAnnouncements(seed.announcements, currentPath, { now });
    },
    async search(query, limit = 10) {
      await ensureIndexed();
      const res = await index.search(query, limit);
      if (!res.ok) return [];
      const results: SearchResult[] = [];
      for (const hit of res.value) {
        const id = hit.document.id;
        if (id.startsWith("page:")) {
          const page = bySlug.get(id.slice(5));
          if (!page) continue;
          results.push({ kind: "page", slug: page.slug, title: page.title, score: hit.score ?? 0, snippet: pageText(page).slice(0, 120) });
        } else if (id.startsWith("post:")) {
          const post = postBySlug.get(id.slice(5));
          if (!post) continue;
          results.push({ kind: "post", slug: post.slug, title: post.title, score: hit.score ?? 0, snippet: (post.excerpt ?? post.body).slice(0, 120) });
        }
      }
      return results;
    },
    async posts() {
      return postsSorted.slice();
    },
    async post(slug) {
      return postBySlug.get(slug);
    },
    async postsByCategory(categoryId, options = {}) {
      return filterByCategory(postsSorted, categories, categoryId, options);
    },
    async categories() {
      return categories.slice();
    },
    async categoryTree() {
      return categoryTree(categories);
    },
    async categoryBySlug(slug) {
      return findCategoryBySlug(categories, slug);
    },
    async categoryBreadcrumb(categoryId) {
      return categoryPath(categories, categoryId);
    },
    async categoryCounts() {
      return countByCategory(postsSorted);
    },
    async banners(currentPath, slot) {
      return activeBanners(banners, currentPath, slot !== undefined ? { slot } : {});
    },
    async pickBanner(currentPath, slot, random) {
      return rotateBanner(banners, currentPath, { ...(slot !== undefined ? { slot } : {}), ...(random ? { random } : {}) });
    },
    async tags() {
      return allTags(postsSorted);
    },
    async postsByTag(tag) {
      return postsByTag(postsSorted, tag);
    },
    async adjacent(slug) {
      // BlogLike は id が必要。slug を id として渡す。
      const withId = postsSorted.map((p) => ({ ...p, id: p.slug }));
      const adj = adjacentPosts(withId, slug);
      const result: { prev?: BlogPost; next?: BlogPost } = {};
      if (adj.prev) result.prev = postBySlug.get(adj.prev.slug);
      if (adj.next) result.next = postBySlug.get(adj.next.slug);
      return result;
    },
    async related(slug, limit = 3) {
      const target = postBySlug.get(slug);
      if (!target) return [];
      const withId = postsSorted.map((p) => ({ ...p, id: p.slug }));
      const rel = relatedPosts(withId, { ...target, id: target.slug }, { limit });
      return rel.map((p) => postBySlug.get(p.slug)).filter((p): p is BlogPost => p !== undefined);
    },
  };
}

/** 安全なテキスト（見出し等・属性用）。 */
export function safeText(input: string): string {
  return escapeHtml(input);
}
