/**
 * パーマリンク(URL 構造)の生成(純ロジック)。
 * 記事と URL パターン(WordPress 風トークン)から記事 URL を組み立てる。逆にパスからトークンを取り出す。
 * 例: パターン "/blog/:year/:month/:slug" + 記事 → "/blog/2025/07/hello"。
 * @packageDocumentation
 */
import { slugify } from "./slug";

/** パーマリンク生成に使う記事フィールド。 */
export interface PermalinkPost {
  slug: string;
  id?: string;
  category?: string;
  /** 公開日時(ISO 8601)。:year/:month/:day の元になる。 */
  publishedAt?: string;
  [key: string]: unknown;
}

/** よく使う URL パターン。 */
export const PERMALINK_PRESETS = {
  /** /記事スラッグ */
  postName: "/:slug",
  /** /2025/07/25/記事スラッグ */
  dateAndName: "/:year/:month/:day/:slug",
  /** /2025/07/記事スラッグ */
  monthAndName: "/:year/:month/:slug",
  /** /カテゴリ/記事スラッグ */
  category: "/:category/:slug",
  /** /archives/123(ID ベース) */
  numeric: "/archives/:id",
  /** /blog/記事スラッグ */
  blog: "/blog/:slug",
} as const;

/** パーマリンク生成のオプション。 */
export interface PermalinkOptions {
  /** カテゴリのスラッグ化で日本語を残すか。 */
  allowUnicode?: boolean;
  /** 日付トークンのタイムゾーン(分・既定 0=UTC)。日本は 540(JST)。 */
  utcOffsetMinutes?: number;
}

/** 日付を指定タイムゾーンにずらして年月日を取り出す。 */
function dateParts(iso: string, offsetMinutes: number): { year: string; month: string; day: string } {
  const shifted = new Date(new Date(iso).getTime() + offsetMinutes * 60_000);
  return {
    year: String(shifted.getUTCFullYear()),
    month: String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    day: String(shifted.getUTCDate()).padStart(2, "0"),
  };
}

/**
 * パターンと記事からパス(先頭 / 付き・末尾 / なし)を組み立てる。
 * 使えるトークン: :slug :id :category :year :month :day。
 * 値の無いトークンは空になり、結果の空セグメントは詰められる。
 *
 * **URL の形をパターンで決められる**ので、後から `/2026/07/slug` 形式に変えても
 * コードを直さなくてよい(設定を変えるだけ)。
 *
 * @param post 記事
 * @param pattern パターン(`/:year/:month/:slug` など)
 * @returns パス(**先頭 `/` 付き・末尾 `/` なし**)
 */
export function buildPermalink(pattern: string, post: PermalinkPost, options: PermalinkOptions = {}): string {
  const offset = options.utcOffsetMinutes ?? 0;
  const dp = post.publishedAt ? dateParts(post.publishedAt, offset) : { year: "", month: "", day: "" };
  const tokens: Record<string, string> = {
    slug: post.slug,
    id: post.id ?? "",
    category: post.category ? slugify(post.category, { allowUnicode: options.allowUnicode }) : "",
    year: dp.year,
    month: dp.month,
    day: dp.day,
  };
  const replaced = pattern.replace(/:([a-zA-Z]+)/g, (m, key: string) => (key in tokens ? tokens[key]! : m));
  const segments = replaced.split("/").filter((seg) => seg.length > 0);
  return "/" + segments.join("/");
}

/**
 * ベース URL とパスを結合する。
 *
 * **スラッシュの重複・欠落を吸収する**(`site.com/` + `/posts` が `site.com//posts` に
 * ならない)。手で結合すると必ずどこかで間違える。
 *
 * @param base ベース URL
 * @param path パス
 * @returns 結合した URL
 */
export function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  const p = path.replace(/^\/+/, "");
  return p ? `${b}/${p}` : b;
}

/**
 * 記事の絶対 URL を作る。
 *
 * **絶対 URL が要る場面がある**(RSS・OGP・メール本文)。相対パスでは機能しない。
 *
 * @param post 記事
 * @param baseUrl サイトの URL
 * @param pattern パスのパターン(`/:year/:month/:slug` など)
 * @returns 絶対 URL
 */
export function postUrl(post: PermalinkPost, options: PermalinkOptions & { pattern: string; baseUrl: string }): string {
  return joinUrl(options.baseUrl, buildPermalink(options.pattern, post, options));
}

/**
 * パスがパターンに一致すればトークン値を返す(ルーティング・URL 解析用)。一致しなければ null。
 * 例: matchPermalink("/blog/:year/:month/:slug", "/blog/2025/07/hello")
 *      → { year:"2025", month:"07", slug:"hello" }
 *
 * {@link buildPermalink} の逆。**同じパターンを使う**ことで、生成と解析がずれない。
 *
 * @param pattern パターン
 * @param path 判定するパス
 * @returns トークン → 値。**一致しなければ null**
 */
export function matchPermalink(pattern: string, path: string): Record<string, string> | null {
  const patternSegs = pattern.split("/").filter(Boolean);
  const pathSegs = path.split("?")[0]!.split("/").filter(Boolean);
  if (patternSegs.length !== pathSegs.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternSegs.length; i++) {
    const pat = patternSegs[i]!;
    const val = pathSegs[i]!;
    if (pat.startsWith(":")) {
      params[pat.slice(1)] = decodeURIComponent(val);
    } else if (pat !== val) {
      return null;
    }
  }
  return params;
}
