/**
 * インデックス可視性ポリシー(純ロジック)。
 * 社内ツールは既定で検索避け(noindex)、公開サイトのみ明示的にインデックス許可する。
 * 「うっかり公開」を防ぐため、社内向けの安全な既定を用意する。
 *
 * 堅牢な運用: 社内アプリは (1) 全レスポンスに X-Robots-Tag ヘッダ(HTML 以外も効く)、
 * (2) robots.txt で全拒否、(3) 各ページに noindex メタ、の三重で守る。
 * ページ単位の付け忘れを避けるため、(1)(2) をミドルウェア/設定で一括適用するのが望ましい。
 * @packageDocumentation
 */
import { type RobotsDirective, robotsContent } from "./meta.js";
import { buildRobotsTxt } from "./robots.js";

/** サイトの公開区分。internal=社内(検索避け), public=一般公開(SEO 対象)。 */
export type SiteVisibility = "public" | "internal";

/** 公開区分に応じた robots ディレクティブを返す。社内は noindex/nofollow/noarchive。 */
export function robotsForVisibility(visibility: SiteVisibility): RobotsDirective {
  return visibility === "public"
    ? { index: true, follow: true }
    : { index: false, follow: false, noarchive: true };
}

/** 社内ツール用の robots メタ content("noindex, nofollow, noarchive")。 */
export function noindexRobots(): string {
  return robotsContent(robotsForVisibility("internal"));
}

/**
 * X-Robots-Tag ヘッダの値を返す。HTML 以外(PDF・API・画像)にも効き、ページ単位の
 * メタ付け忘れを補える。社内アプリのミドルウェアで全レスポンスに付与する。
 */
export function xRobotsTag(visibility: SiteVisibility): string {
  return robotsContent(robotsForVisibility(visibility));
}

/** 社内ツール用 robots.txt(全クローラーを全パス拒否)。 */
export function internalRobotsTxt(): string {
  return buildRobotsTxt({ rules: [{ userAgent: "*", disallow: ["/"] }] });
}

/** 公開サイト用 robots.txt(全許可 + サイトマップ)。 */
export function publicRobotsTxt(sitemap?: string): string {
  return buildRobotsTxt({ rules: [{ userAgent: "*", allow: ["/"] }], sitemaps: sitemap ? [sitemap] : undefined });
}
