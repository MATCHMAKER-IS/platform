/**
 * SNS シェア用の URL 生成（純関数）。
 * @packageDocumentation
 */

/** シェア可能なプラットフォーム。 */
export type SharePlatform = "x" | "facebook" | "line" | "hatena" | "linkedin" | "email" | "whatsapp" | "telegram";

/** シェア対象の情報。 */
export interface ShareTarget {
  url: string;
  title?: string;
  /** ハッシュタグ（# 抜き）。 */
  hashtags?: string[];
  /** X の投稿元アカウント（@ 抜き）。 */
  via?: string;
}

function enc(v: string): string {
  return encodeURIComponent(v);
}

/**
 * シェア URL を生成する。
 *
 * **プラットフォームごとにパラメータ名が違う**(X は `text`、他は別)。
 * ここで吸収するので、呼び出し側は意識しなくてよい。
 *
 * @param platform プラットフォーム
 * @param options.url シェアする URL
 * @param options.text 添える文
 * @returns シェア用の URL(**新しいタブで開く**)
 */
export function shareUrl(platform: SharePlatform, target: ShareTarget): string {
  const url = enc(target.url);
  const title = target.title ? enc(target.title) : "";
  switch (platform) {
    case "x": {
      const params = [`url=${url}`];
      if (target.title) params.push(`text=${title}`);
      if (target.hashtags && target.hashtags.length > 0) params.push(`hashtags=${enc(target.hashtags.join(","))}`);
      if (target.via) params.push(`via=${enc(target.via)}`);
      return `https://twitter.com/intent/tweet?${params.join("&")}`;
    }
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    case "line":
      return `https://social-plugins.line.me/lineit/share?url=${url}`;
    case "hatena":
      return `https://b.hatena.ne.jp/entry/${target.url.replace(/^https?:\/\//, "")}`;
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
    case "email":
      return `mailto:?subject=${title}&body=${url}`;
    case "whatsapp":
      return `https://api.whatsapp.com/send?text=${target.title ? `${title}%20` : ""}${url}`;
    case "telegram":
      return `https://t.me/share/url?url=${url}${target.title ? `&text=${title}` : ""}`;
    default:
      return target.url;
  }
}

/** 表示名。 */
export const SHARE_LABELS: Record<SharePlatform, string> = {
  x: "X", facebook: "Facebook", line: "LINE", hatena: "はてブ", linkedin: "LinkedIn", email: "メール", whatsapp: "WhatsApp", telegram: "Telegram",
};

/**
 * 複数プラットフォームのシェアリンクをまとめて作る。
 *
 * @param options.url シェアする URL
 * @param options.text 添える文
 * @param options.platforms 対象(既定は全部)
 * @returns プラットフォームとシェア URL の配列
 */
export function shareLinks(platforms: SharePlatform[], target: ShareTarget): { platform: SharePlatform; label: string; url: string }[] {
  return platforms.map((p) => ({ platform: p, label: SHARE_LABELS[p], url: shareUrl(p, target) }));
}
