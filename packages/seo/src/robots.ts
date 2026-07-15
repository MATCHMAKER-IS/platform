/**
 * robots.txt の生成(純ロジック)。
 * クローラーへのアクセス許可・拒否ルールとサイトマップの場所を出力する。
 * @packageDocumentation
 */

/** 1 つのクローラー向けルール。 */
export interface RobotsRule {
  /** 対象クローラー(既定 "*")。 */
  userAgent?: string;
  /** 許可パス。 */
  allow?: string[];
  /** 拒否パス。 */
  disallow?: string[];
  /** クロール間隔(秒)。 */
  crawlDelay?: number;
}

/** robots.txt の入力。 */
export interface RobotsTxtInput {
  rules: RobotsRule[];
  /** サイトマップの URL(複数可)。 */
  sitemaps?: string[];
}

/** robots.txt の文字列を生成する。 */
export function buildRobotsTxt(input: RobotsTxtInput): string {
  const blocks: string[] = [];
  for (const rule of input.rules) {
    const lines: string[] = [`User-agent: ${rule.userAgent ?? "*"}`];
    for (const path of rule.allow ?? []) lines.push(`Allow: ${path}`);
    for (const path of rule.disallow ?? []) lines.push(`Disallow: ${path}`);
    if (rule.crawlDelay !== undefined) lines.push(`Crawl-delay: ${rule.crawlDelay}`);
    blocks.push(lines.join("\n"));
  }
  let out = blocks.join("\n\n");
  if (input.sitemaps && input.sitemaps.length > 0) {
    out += "\n\n" + input.sitemaps.map((s) => `Sitemap: ${s}`).join("\n");
  }
  return out;
}

/** 全クローラーを許可する robots.txt(サイトマップ付き)。 */
export function allowAllRobotsTxt(sitemap?: string): string {
  return buildRobotsTxt({ rules: [{ userAgent: "*", allow: ["/"] }], sitemaps: sitemap ? [sitemap] : undefined });
}
