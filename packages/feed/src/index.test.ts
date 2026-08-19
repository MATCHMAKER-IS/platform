import { describe, expect, it } from "vitest";
import { buildRssFeed, buildAtomFeed, buildSitemap, buildSitemapIndex, escapeXml } from "./index";

const channel = { title: "社内ブログ", link: "https://example.jp", description: "お知らせ" };
const entries = [
  { title: "A&B社の件", link: "https://example.jp/1", published: "2026-08-10T03:00:00Z" },
];

describe("XML のエスケープ", () => {
  // **忘れるとフィード全体が読めなくなる。** 記事タイトルに `&` が入るのは普通で
  // (「A&B社の件」)、1 記事のせいで**購読者全員に何も届かない**
  it("5 文字すべてを変換する", () => {
    expect(escapeXml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&apos;");
  });
  // **`&` を最初に変換する。** 後にすると `&amp;lt;` のように壊れる
  it("実体参照を二重に変換しない", () => {
    expect(escapeXml("<a>")).toBe("&lt;a&gt;");
  });
  it("undefined は空文字", () => {
    expect(escapeXml(undefined)).toBe("");
  });
});

describe("RSS 2.0", () => {
  it("タイトルをエスケープする", () => {
    expect(buildRssFeed(channel, entries)).toContain("A&amp;B社の件");
  });
  // **日付は RFC 822。** ISO 8601 のまま出すと読み手によっては無視される
  it("日付を RFC 822 にする", () => {
    expect(buildRssFeed(channel, entries)).toMatch(/<pubDate>.*GMT<\/pubDate>/);
  });
  // **`isPermaLink="false"`。** id が URL とは限らないので、
  // URL として解決しようとされるのを防ぐ
  it("guid は永続リンクでないと明示する", () => {
    expect(buildRssFeed(channel, entries)).toContain('isPermaLink="false"');
  });
  // **不正な日付は落とす**(`Invalid Date` を出すとフィードが壊れる)
  it("壊れた日付は出さない", () => {
    const bad = buildRssFeed(channel, [{ title: "x", link: "https://e.jp/x", published: "壊れた値" }]);
    expect(bad).not.toContain("Invalid");
    expect(bad).not.toContain("<pubDate>");
  });
});

describe("Atom 1.0", () => {
  // **日付は ISO 8601**(RSS とは違う)。日付だけでも受けて正規化する
  it("日付を ISO 8601 に正規化する", () => {
    const xml = buildAtomFeed(channel, [{ title: "x", link: "https://e.jp/x", published: "2026-08-10" }]);
    expect(xml).toContain("<updated>2026-08-10T00:00:00.000Z</updated>");
  });
  // **`updated` は必須**(無いと読み手が弾くことがある)
  it("記事が無くても updated を出す", () => {
    expect(buildAtomFeed(channel, [])).toMatch(/<updated>.+<\/updated>/);
  });
});

describe("sitemap.xml", () => {
  // **日付だけに切る。** 時刻を出すと更新のたびに全 URL が変わって見える
  it("lastmod は日付だけ", () => {
    const xml = buildSitemap([{ loc: "https://e.jp/a", lastmod: "2026-08-10T03:00:00Z" }]);
    expect(xml).toContain("<lastmod>2026-08-10</lastmod>");
  });
  // **0.0〜1.0 に収める**(範囲外は仕様違反で無視される)
  it("priority を範囲内に収める", () => {
    expect(buildSitemap([{ loc: "https://e.jp/a", priority: 1.5 }])).toContain("<priority>1.0</priority>");
    expect(buildSitemap([{ loc: "https://e.jp/a", priority: -1 }])).toContain("<priority>0.0</priority>");
  });
  it("URL のクエリをエスケープする", () => {
    expect(buildSitemap([{ loc: "https://e.jp/a?q=1&r=2" }])).toContain("q=1&amp;r=2");
  });
  // **5 万 URL を超えたら索引に分ける**(仕様上の上限)
  it("索引を作れる", () => {
    expect(buildSitemapIndex([{ loc: "https://e.jp/s1.xml" }])).toContain("<sitemapindex");
  });
});
