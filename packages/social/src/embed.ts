/**
 * 投稿の埋め込み(oEmbed)URL 生成(純ロジック)。
 * 投稿 URL から各プラットフォームの oEmbed エンドポイント URL を組み立てる。
 * 実際の取得(fetch)と表示はアプリ側。埋め込みには各社の埋め込みスクリプト読み込みが必要。
 * @packageDocumentation
 */
import { type SocialPlatform } from "./platforms.js";

/** oEmbed エンドポイントのベース。 */
const OEMBED_ENDPOINTS: Record<SocialPlatform, string | null> = {
  x: "https://publish.twitter.com/oembed",
  tiktok: "https://www.tiktok.com/oembed",
  // Instagram の oEmbed は Facebook アプリのアクセストークンが必要(公開エンドポイントは廃止)。
  instagram: null,
};

/** oEmbed オプション。 */
export interface OEmbedOptions {
  /** 最大幅(px)。 */
  maxWidth?: number;
  /** テーマ(X は dark 対応)。 */
  theme?: "light" | "dark";
  /** 言語(X は lang)。 */
  lang?: string;
  /** 装飾を省く(X は omit_script/hide_thread など)。 */
  omitScript?: boolean;
}

/**
 * 投稿 URL から oEmbed エンドポイント URL を作る。
 * Instagram はトークンが必要なため null(アプリ側で Graph API 経由に)。
 *
 * @param url 投稿の URL
 * @returns oEmbed のエンドポイント。**Instagram はトークンが必要なため null**(Graph API 経由にする)
 */
export function oembedEndpoint(platform: SocialPlatform, postUrl: string, options: OEmbedOptions = {}): string | null {
  const base = OEMBED_ENDPOINTS[platform];
  if (!base) return null;
  const params = new URLSearchParams({ url: postUrl });
  if (options.maxWidth !== undefined) params.set("maxwidth", String(options.maxWidth));
  if (options.theme) params.set("theme", options.theme);
  if (options.lang) params.set("lang", options.lang);
  if (options.omitScript) params.set("omit_script", "1");
  return `${base}?${params.toString()}`;
}

/**
 * そのプラットフォームが公開 oEmbed に対応しているかを判定する。
 *
 * **対応していないものは埋め込めない**(認証が要るか、そもそも API が無い)。
 * 埋め込みを試みる前に確認する。
 *
 * @param platform プラットフォーム
 * @returns 対応していれば true
 */
export function supportsOEmbed(platform: SocialPlatform): boolean {
  return OEMBED_ENDPOINTS[platform] !== null;
}
