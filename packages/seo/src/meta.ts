/**
 * SEO メタタグの生成(純ロジック)。
 * title(テンプレート適用)・description(文字数調整)・canonical・robots・keywords を
 * フレームワーク非依存の記述子として作り、HTML 文字列にも変換できる。
 * Next.js の Metadata API にもそのまま渡せる形。
 * @packageDocumentation
 */

/** メタタグ 1 個(name か property のいずれかを持つ)。 */
export interface MetaTag {
  name?: string;
  property?: string;
  content: string;
}

/** robots ディレクティブ。 */
export interface RobotsDirective {
  /** インデックス許可(既定 true)。false で noindex。 */
  index?: boolean;
  /** リンク追跡許可(既定 true)。false で nofollow。 */
  follow?: boolean;
  /** キャッシュ表示を禁止。 */
  noarchive?: boolean;
  /** スニペット表示を禁止。 */
  nosnippet?: boolean;
  /** スニペット最大文字数。 */
  maxSnippet?: number;
}

/**
 * HTML の属性値をエスケープする。
 *
 * **メタタグに記事タイトルを入れるときは必ず通す**。
 * タイトルに `"` が含まれると属性が壊れ、そこから任意のタグを差し込まれる。
 *
 * @param value 属性値
 * @returns エスケープした文字列
 */
export function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 公開区分から robots ディレクティブを導く(内部用)。 */
function robotsForVisibilityInline(visibility: "public" | "internal"): RobotsDirective {
  return visibility === "public" ? { index: true, follow: true } : { index: false, follow: false, noarchive: true };
}

/**
 * robots の content 文字列を組み立てる。
 *
 * @param options index / follow / archive などの指定
 * @returns `"index, follow"` 形式の文字列
 */
export function robotsContent(directive: RobotsDirective): string {
  const parts: string[] = [];
  parts.push(directive.index === false ? "noindex" : "index");
  parts.push(directive.follow === false ? "nofollow" : "follow");
  if (directive.noarchive) parts.push("noarchive");
  if (directive.nosnippet) parts.push("nosnippet");
  if (directive.maxSnippet !== undefined) parts.push(`max-snippet:${directive.maxSnippet}`);
  return parts.join(", ");
}

/** メタ情報の入力。 */
export interface MetaInput {
  /** ページタイトル。 */
  title: string;
  /** タイトルテンプレート("%s | サイト名" の %s に title が入る)。 */
  titleTemplate?: string;
  /** ページの説明。 */
  description?: string;
  /** 正規 URL(canonical)。 */
  canonical?: string;
  /** キーワード(現在は影響小だが出力可)。 */
  keywords?: string[];
  /** robots ディレクティブ。 */
  robots?: RobotsDirective;
  /**
   * 公開区分。"internal"(社内)は自動で noindex、"public"(一般公開)は index。
   * robots を明示した場合はそちらが優先。社内ツールは "internal" を指定すると検索避けになる。
   */
  visibility?: "public" | "internal";
}

/**
 * タイトルにテンプレートを適用する。
 *
 * 「記事タイトル | サイト名」のような形を全ページで揃える。
 *
 * @param title ページのタイトル
 * @param titleTemplate テンプレート(`%s` がタイトルに置き換わる。省略時はそのまま)
 * @returns 適用したタイトル。**テンプレートが無ければそのまま**
 */
export function buildTitle(title: string, titleTemplate?: string): string {
  if (!titleTemplate) return title;
  return titleTemplate.replace("%s", title);
}

/**
 * description を検索結果向けの長さに調整する。
 *
 * **長すぎると検索結果で途中で切られる**(何を言いたいか伝わらない)。
 * 160 文字程度が目安。
 *
 * @param text 説明文
 * @param maxLength 最大文字数(既定 160)
 * @returns 調整した説明文
 */
export function truncateDescription(text: string, maxLength = 160): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= maxLength) return t;
  return t.slice(0, maxLength - 1).trimEnd() + "…";
}

/** メタ情報の生成結果。 */
export interface MetaResult {
  title: string;
  tags: MetaTag[];
  canonical?: string;
}

/**
 * メタタグ一式を組み立てる(title / description / OGP / Twitter Card)。
 *
 * @param input タイトル・説明・URL・画像など
 * @returns メタ情報のオブジェクト
 */
export function buildMeta(input: MetaInput): MetaResult {
  const title = buildTitle(input.title, input.titleTemplate);
  const tags: MetaTag[] = [];
  if (input.description) tags.push({ name: "description", content: truncateDescription(input.description) });
  if (input.keywords && input.keywords.length > 0) tags.push({ name: "keywords", content: input.keywords.join(", ") });
  const robots = input.robots ?? (input.visibility ? robotsForVisibilityInline(input.visibility) : undefined);
  if (robots) tags.push({ name: "robots", content: robotsContent(robots) });
  return { title, tags, canonical: input.canonical };
}

/**
 * メタ情報を HTML(head 内のタグ)に変換する。
 *
 * **値はエスケープ済み**({@link escapeAttribute} を内部で通す)。
 *
 * @param meta メタ情報
 * @returns head に入れる HTML 文字列
 */
export function renderMeta(result: MetaResult): string {
  const lines: string[] = [`<title>${escapeAttr(result.title)}</title>`];
  for (const tag of result.tags) {
    const key = tag.property ? `property="${tag.property}"` : `name="${tag.name}"`;
    lines.push(`<meta ${key} content="${escapeAttr(tag.content)}">`);
  }
  if (result.canonical) lines.push(`<link rel="canonical" href="${escapeAttr(result.canonical)}">`);
  return lines.join("\n");
}

/**
 * メタタグの配列を HTML に変換する(OGP / Twitter Card 用)。
 *
 * @param tags メタタグの配列
 * @returns `<meta>` 行の HTML
 */
export function renderMetaTags(tags: MetaTag[]): string {
  return tags
    .map((tag) => {
      const key = tag.property ? `property="${tag.property}"` : `name="${tag.name}"`;
      return `<meta ${key} content="${escapeAttr(tag.content)}">`;
    })
    .join("\n");
}
