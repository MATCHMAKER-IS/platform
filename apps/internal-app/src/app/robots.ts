import { internalRobotsTxt } from "@platform/seo";

/**
 * 社内アプリの robots.txt。全クローラーを全パス拒否する。
 * 公開サイト(ブログ/LP/EC/予約)では publicRobotsTxt(sitemapUrl) を使う。
 */
export function GET(): Response {
  return new Response(internalRobotsTxt(), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
