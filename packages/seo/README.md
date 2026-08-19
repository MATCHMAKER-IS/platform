# @platform/seo

検索エンジン向けの設定（メタ情報・サイトマップ・robots）。

## これは何のためか

**社内アプリは「載せない」ことが目的**です。

公開サイト（`public-site`）は載せたい、社内アプリは載せたくない——
**同じ仕組みで、逆のことをします**。

## 使う前に知っておくこと

| | |
|---|---|
| **社内アプリは `internalRobotsTxt`** | **すべて拒否**します。付け忘れると、**社内の画面が検索に出ます** |
| **`robots.txt` は「お願い」です** | 守らない巡回もあります——**本当に隠すなら認証**を付けてください |
| **`noindex` と `robots.txt` は別** | `robots.txt` で拒否すると、**`noindex` を読みに来ません**——**すでに載ったものは消えません** |
| **サイトマップは公開サイトだけ** | 社内アプリに置くと、**画面の一覧を教えることになります** |

## よく使うもの

```ts
import { faviconLinks, faviconMetadata, robotsForVisibility } from "@platform/seo";
import { buildMeta, renderMeta } from "@platform/seo";
const meta = buildMeta({
  title: "記事タイトル",
  titleTemplate: "%s | サイト名",
  description: longText,               // 160文字に自動調整
  canonical: "https://example.com/blog/a",
  robots: { index: true, follow: true },
});
const headHtml = renderMeta(meta);     // <title>・<meta>・<link canonical>
```

## Open Graph / Twitter Card
```ts
import { buildOpenGraphTags, buildTwitterCardTags, renderMetaTags } from "@platform/seo";
const og = buildOpenGraphTags({ title, description, url, image, type: "article", siteName: "サイト",
  article: { publishedTime, author, tags } });
const tw = buildTwitterCardTags({ title, description, image, site: "@site" });
const html = renderMetaTags([...og, ...tw]);
```

## JSON-LD 構造化データ(リッチリザルト)
```ts
import { articleJsonLd, breadcrumbJsonLd, productJsonLd, faqJsonLd, websiteJsonLd, renderJsonLd } from "@platform/seo";

renderJsonLd(articleJsonLd({ headline, datePublished, authorName, publisherName, publisherLogo, url }));
renderJsonLd(breadcrumbJsonLd([{ name: "ホーム", url }, { name: "記事", url }]));
renderJsonLd(productJsonLd({ name, price: 1980, currency: "JPY", availability: "InStock" }));   // EC
renderJsonLd(faqJsonLd([{ question, answer }]));
renderJsonLd(websiteJsonLd({ name, url, searchUrl: "https://ex.com/search?q={search_term_string}" }));
```
記事・パンくず・組織・サイト(検索ボックス)・商品・FAQ に対応。`renderJsonLd` は `<` を `\u003c` にエスケープし、`</script>` 注入を防ぎます。

## robots.txt
```ts
import { buildRobotsTxt, allowAllRobotsTxt } from "@platform/seo";
buildRobotsTxt({ rules: [{ userAgent: "*", disallow: ["/admin", "/api"], allow: ["/"] }], sitemaps: ["https://ex.com/sitemap.xml"] });
allowAllRobotsTxt("https://ex.com/sitemap.xml");   // 全許可 + サイトマップ
```

## サイトマップ・RSS は @platform/blog
```ts
import { buildSitemap, buildRssFeed } from "@platform/blog";
```

## 公開/社内の可視性ポリシー(検索避け)
**社内ツールは検索エンジンに載せない**のが既定です。SEO(この節より上の機能)はブログ・公式サイト・
LP・EC・予約サイトなど**一般公開するもののみ**に適用します。
```ts
import { xRobotsTag, internalRobotsTxt, publicRobotsTxt, buildMeta } from "@platform/seo";

// 社内アプリ: ページに noindex メタ
buildMeta({ title: "経費精算", visibility: "internal" });   // robots: noindex, nofollow, noarchive

// 社内アプリ(堅牢): ミドルウェアで全レスポンスに X-Robots-Tag(HTML以外も効く・付け忘れ防止)
res.headers.set("X-Robots-Tag", xRobotsTag("internal"));
// + robots.txt を全拒否に
internalRobotsTxt();                    // User-agent: * / Disallow: /

// 公開サイト: インデックス許可 + サイトマップ
buildMeta({ title: "料金プラン", visibility: "public" });   // robots: index, follow
publicRobotsTxt("https://example.com/sitemap.xml");
```
**推奨**: 社内アプリは (1) ミドルウェアの X-Robots-Tag、(2) robots.txt 全拒否、(3) 各ページの noindex メタ、の三重で守る。(1)(2) は一括適用できるので付け忘れが起きません。同梱の `apps/internal-app` はこの三重を実装済みです。

