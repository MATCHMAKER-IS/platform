# @platform/feed

RSS / Atom フィードの生成。**更新を購読してもらう**ためのものです。

## これは何のためか

**見に来てもらうのではなく、届ける**ためのものです。

社外向けのお知らせを、**取引先が購読**できるようにします。

## 使う前に知っておくこと

| | |
|---|---|
| **1 文字の間違いで全部届きません** | XML が壊れると、**購読者全員に何も届きません**——しかも**こちらは気づけません** |
| **`&` を最初に変換する** | 後にすると、**`&amp;` の `&` まで変換**されて `&amp;amp;` になります |
| **日付は RFC 822** | ISO 8601 ではありません——**形式を間違えると読めない**リーダーがあります |
| **社内向けには使わない** | フィードに**認証はありません**。URL を知れば誰でも読めます |

## よく使うもの

```ts
import { buildRssFeed, escapeXml } from "@platform/feed";
import { buildRssFeed, buildAtomFeed, buildSitemap } from "@platform/feed";

const channel = { title: "社内ブログ", link: "https://example.jp", description: "お知らせ" };
const entries = [{ title: "A&B社の件", link: "https://example.jp/1", publishedAt: "2026-08-10" }];

buildRssFeed(channel, entries);
buildAtomFeed(channel, entries);
buildSitemap([{ loc: "https://example.jp/1", lastmod: "2026-08-10", priority: 0.8 }]);
```

## エスケープを忘れない

**文字列連結で XML を作るので、エスケープを忘れると壊れます。**
記事タイトルに `&` や `<` が入るのは普通で(「A&B社の件」)、そのまま出すと
**フィード全体が読めなくなります**——1 記事のせいで購読者全員に何も届きません。

この基盤は**すべての値をエスケープしてから**組み立てます。

## 日付の形式が RSS と Atom で違う

| | 形式 | 例 |
|---|---|---|
| RSS | RFC 822 | `Mon, 10 Aug 2026 03:00:00 GMT` |
| Atom | ISO 8601 | `2026-08-10T03:00:00Z` |
| sitemap | 日付だけ | `2026-08-10` |

**ISO 8601 のまま RSS に出すと、読み手によっては無視されます。**
`buildRssFeed` は渡された ISO 8601 を自動で変換します。

sitemap は日単位で足りるうえ、時刻を出すと**更新のたびに全 URL が変わって見える**
(クロールの無駄)ので、日付だけに切ります。

## 公開しているページだけを入れる

下書きや管理画面を sitemap に載せると、**検索エンジン経由で存在が漏れます**
——認証があっても URL は知られます。

## 1 ファイルの上限

sitemap は **5 万 URL・50MB** が仕様上の上限です。超えるならサイトマップ索引に分けてください。
