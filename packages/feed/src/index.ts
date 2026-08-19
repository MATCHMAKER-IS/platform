/**
 * `@platform/feed` — RSS 2.0 / Atom 1.0 / sitemap.xml の生成(純関数)。
 *
 * 【なぜ 1 つにまとめるか】
 * 2026-08 まで `@platform/blog` と `@platform/seo` が**別々に持っており**、
 * **`lastmod` の扱いが違う**(blog は日付だけに切る / seo はそのまま)、
 * **エスケープの関数が違う**(`escapeXml` / `escapeAttr`)といった差が出ていた。
 * どちらも仕様上は妥当だが、**同じサイトで両方使うと不揃い**になる。
 *
 * 【XML を組み立てる怖さ】
 * **文字列連結で XML を作るので、エスケープを忘れると壊れる。**
 * 記事タイトルに `&` や `<` が入るのは普通で(「A&B社の件」)、
 * そのまま出すと**フィード全体が読めなくなる**——1 記事のせいで
 * 購読者全員に何も届かない。ここでは**すべての値をエスケープしてから**組み立てる。
 *
 * @packageDocumentation
 */

/**
 * XML の特殊文字を実体参照にする。
 *
 * **`@platform/xml` と同じ実装。** 依存を増やさないため複製している
 * ——smoke がこのファイルを単体で読み込むので、外部 import を足すと解決できない。
 * **片方を直したらもう片方も**(2026-08)。
 *
 * 属性にも要素にも使えるように 5 文字すべてを変換する
 * (`&` `<` `>` `"` `'`)。**`&` を最初に変換する**——後にすると、
 * 変換した実体参照の `&` をさらに変換して `&amp;lt;` のように壊れる。
 *
 * @param value 変換する値(数値や `undefined` も受ける)
 * @returns エスケープ済みの文字列
 */
export function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** フィードの 1 件。 */
export interface FeedEntry {
  /** 表題。 */
  title: string;
  /** 記事の URL(**絶対 URL**。相対だと読み手が解決できない)。 */
  link: string;
  /**
   * 一意な識別子(省略時は `link`)。
   *
   * **URL を変えるときはここを固定する。** これが変わると
   * 読み手は**別の記事だと思って再通知**する。
   */
  id?: string;
  /** 要約。 */
  description?: string;
  /** 公開日時(ISO 8601)。 */
  published?: string;
  /** 著者名。 */
  author?: string;
}

/** フィード全体の情報。 */
export interface FeedChannel {
  /** サイト名。 */
  title: string;
  /** サイトの URL。 */
  link: string;
  /** サイトの説明。 */
  description: string;
  /** 言語(既定 `"ja"`)。 */
  language?: string;
  /** 最終更新(ISO 8601。省略時は最新記事の日付)。 */
  updated?: string;
  /**
   * このフィード自身の URL(`rel="self"`)。
   *
   * **入れておくと読み手が正しく購読できる。** 転載やコピーで
   * **別の場所から配られたときに、元の場所が分かる**。
   */
  feedUrl?: string;
}

/**
 * ISO 8601 に正規化する(Atom の日付形式)。
 *
 * **`2026-08-10` のような日付だけでも受ける。** そのまま出すと
 * Atom の仕様(RFC 3339)に合わず、**読み手が弾く**ことがある。
 */
function toIso(value: string | undefined): string | undefined {
  if (value === undefined || value === "") return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** ISO 8601 を RFC 822(RSS の日付形式)にする。 */
function toRfc822(iso: string | undefined): string | undefined {
  if (iso === undefined || iso === "") return undefined;
  const d = new Date(iso);
  // **不正な日付は落とす。** `Invalid Date` を出すとフィードが壊れる
  return Number.isNaN(d.getTime()) ? undefined : d.toUTCString();
}

/**
 * RSS 2.0 のフィードを作る。
 *
 * **日付は RFC 822 形式**(`Mon, 10 Aug 2026 03:00:00 GMT`)——
 * RSS の仕様で決まっており、ISO 8601 のまま出すと**読み手によっては無視される**。
 *
 * @param channel サイトの情報
 * @param entries 記事(**新しい順に並べておくこと**。ここでは並べ替えない)
 * @returns RSS 2.0 の XML
 *
 * @example
 * ```ts
 * buildRssFeed(
 *   { title: "社内ブログ", link: "https://example.jp", description: "お知らせ" },
 *   [{ title: "A&B社の件", link: "https://example.jp/1", publishedAt: "2026-08-10" }],
 * );
 * ```
 */
export function buildRssFeed(channel: FeedChannel, entries: FeedEntry[]): string {
  const items = entries
    .map((e) => {
      const parts = [
        `    <title>${escapeXml(e.title)}</title>`,
        `    <link>${escapeXml(e.link)}</link>`,
        // **`isPermaLink="false"`。** id が URL とは限らないので、
        // URL として解決しようとされるのを防ぐ
        `    <guid isPermaLink="false">${escapeXml(e.id ?? e.link)}</guid>`,
      ];
      if (e.description !== undefined) parts.push(`    <description>${escapeXml(e.description)}</description>`);
      const pub = toRfc822(e.published);
      if (pub !== undefined) parts.push(`    <pubDate>${escapeXml(pub)}</pubDate>`);
      if (e.author !== undefined) parts.push(`    <author>${escapeXml(e.author)}</author>`);
      return `  <item>\n${parts.join("\n")}\n  </item>`;
    })
    .join("\n");

  const head = [
    `  <title>${escapeXml(channel.title)}</title>`,
    `  <link>${escapeXml(channel.link)}</link>`,
    `  <description>${escapeXml(channel.description)}</description>`,
    `  <language>${escapeXml(channel.language ?? "ja")}</language>`,
  ];
  const updated = toRfc822(channel.updated ?? entries[0]?.published);
  if (updated !== undefined) head.push(`  <lastBuildDate>${escapeXml(updated)}</lastBuildDate>`);

  // **自分自身への参照を入れる**(転載されたときに元が分かる)
  if (channel.feedUrl !== undefined) {
    head.push(`  <atom:link href="${escapeXml(channel.feedUrl)}" rel="self" type="application/rss+xml"/>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
${head.join("\n")}
${items}
</channel>
</rss>`;
}

/**
 * Atom 1.0 のフィードを作る。
 *
 * **日付は ISO 8601 のまま**(RSS とは違う)。
 * Atom は **`updated` が必須**なので、省略時は最新記事の日付を使う。
 *
 * @param channel サイトの情報
 * @param entries 記事(**新しい順に並べておくこと**)
 * @returns Atom 1.0 の XML
 */
export function buildAtomFeed(channel: FeedChannel, entries: FeedEntry[]): string {
  const items = entries
    .map((e) => {
      const parts = [
        `    <title>${escapeXml(e.title)}</title>`,
        `    <link href="${escapeXml(e.link)}"/>`,
        `    <id>${escapeXml(e.id ?? e.link)}</id>`,
      ];
      const up = toIso(e.published);
      if (up !== undefined) parts.push(`    <updated>${escapeXml(up)}</updated>`);
      if (e.description !== undefined) parts.push(`    <summary>${escapeXml(e.description)}</summary>`);
      if (e.author !== undefined) parts.push(`    <author><name>${escapeXml(e.author)}</name></author>`);
      return `  <entry>\n${parts.join("\n")}\n  </entry>`;
    })
    .join("\n");

  // **`updated` は必須。** 無いと読み手が弾くことがある
  const updated = toIso(channel.updated ?? entries[0]?.published) ?? new Date().toISOString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(channel.title)}</title>
  <link href="${escapeXml(channel.link)}"/>${channel.feedUrl !== undefined ? `\n  <link href="${escapeXml(channel.feedUrl)}" rel="self"/>` : ""}
  <id>${escapeXml(channel.link)}</id>
  <updated>${escapeXml(updated)}</updated>
${items}
</feed>`;
}

/** sitemap.xml の 1 件。 */
export interface SitemapEntry {
  /** ページの URL(**絶対 URL**)。 */
  loc: string;
  /** 最終更新(ISO 8601 または `YYYY-MM-DD`)。 */
  lastmod?: string;
  /** 更新頻度の目安。 */
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  /** 優先度(0.0〜1.0)。 */
  priority?: number;
}

/**
 * sitemap.xml を作る。
 *
 * **公開しているページだけ**を入れること——下書きや管理画面を載せると、
 * **検索エンジン経由で存在が漏れる**(認証があっても URL は知られる)。
 *
 * **`lastmod` は日付だけに切る**(`2026-08-10`)。sitemap.org の仕様では
 * 時刻付きでもよいが、**日単位で足りる**うえ、時刻を出すと
 * **更新のたびに全 URL が変わって見える**(クロールの無駄)。
 *
 * **1 ファイル 5 万 URL・50MB が上限**(仕様)。超えるならサイトマップ索引に分ける。
 *
 * @param entries ページの一覧
 * @returns sitemap.xml の XML
 */
export function buildSitemap(entries: SitemapEntry[]): string {
  const urls = entries
    .map((e) => {
      const parts = [`    <loc>${escapeXml(e.loc)}</loc>`];
      // **日付だけに切る**(`2026-08-10T03:00:00Z` → `2026-08-10`)
      if (e.lastmod !== undefined) parts.push(`    <lastmod>${escapeXml(e.lastmod.slice(0, 10))}</lastmod>`);
      if (e.changefreq !== undefined) parts.push(`    <changefreq>${escapeXml(e.changefreq)}</changefreq>`);
      // **0.0〜1.0 に収める。** 範囲外は仕様違反で無視される
      if (e.priority !== undefined) {
        parts.push(`    <priority>${Math.min(1, Math.max(0, e.priority)).toFixed(1)}</priority>`);
      }
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

/**
 * サイトマップ索引を作る(複数の sitemap.xml をまとめる)。
 *
 * **1 ファイル 5 万 URL・50MB を超えたら分ける。** 仕様上の上限で、
 * 超えると**検索エンジンが読み込みを拒否する**——大きいサイトでは
 * 記事用・商品用のように分けて、この索引で束ねる。
 *
 * @param sitemaps 束ねる sitemap.xml の URL
 * @returns sitemapindex の XML
 *
 * @example
 * ```ts
 * buildSitemapIndex([
 *   { loc: "https://example.jp/sitemap-posts.xml", lastmod: "2026-08-10" },
 *   { loc: "https://example.jp/sitemap-products.xml" },
 * ]);
 * ```
 */
export function buildSitemapIndex(sitemaps: { loc: string; lastmod?: string }[]): string {
  const items = sitemaps
    .map((s) => {
      const parts = [`    <loc>${escapeXml(s.loc)}</loc>`];
      // **日付だけに切る**(`buildSitemap` と揃える)
      if (s.lastmod !== undefined) parts.push(`    <lastmod>${escapeXml(s.lastmod.slice(0, 10))}</lastmod>`);
      return `  <sitemap>\n${parts.join("\n")}\n  </sitemap>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</sitemapindex>`;
}
