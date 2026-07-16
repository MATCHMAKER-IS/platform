/**
 * ソーシャル URL の解析(純ロジック)。
 * 貼り付けられた URL からプラットフォーム・ハンドル・投稿種別/ID を判定する。
 * キャストが自分のプロフィール/投稿リンクを貼るだけで連携情報を取り出せる。
 * @packageDocumentation
 */
import { type SocialPlatform, platformFromHostname } from "./platforms";
import { normalizeHandle } from "./handle";

/** 解析結果の種別。 */
export type SocialUrlType = "profile" | "post";

/** ソーシャル URL の解析結果。 */
export interface ParsedSocialUrl {
  platform: SocialPlatform;
  type: SocialUrlType;
  /** ハンドル(取得できた場合)。 */
  handle?: string;
  /** 投稿 ID(post のとき)。 */
  postId?: string;
  /** 投稿の種類(post / video / reel など)。 */
  postKind?: string;
}

/**
 * URL からプラットフォームと内容を解析する。
 *
 * **プロフィールか投稿かも判別する**(`x.com/name` と `x.com/name/status/123`)。
 *
 * @param url URL
 * @returns プラットフォーム・種別・ハンドル・投稿 ID。**判別できなければ null**
 */
export function parseSocialUrl(url: string): ParsedSocialUrl | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const platform = platformFromHostname(u.hostname);
  if (!platform) return null;
  const segments = u.pathname.split("/").filter(Boolean).map((s) => decodeURIComponent(s));

  if (platform === "x") {
    // /{handle}/status/{id} または /{handle}
    if (segments.length >= 3 && segments[1] === "status") {
      return { platform, type: "post", handle: normalizeHandle(segments[0]!), postId: segments[2], postKind: "tweet" };
    }
    if (segments.length >= 1 && !["home", "explore", "search", "i", "messages"].includes(segments[0]!)) {
      return { platform, type: "profile", handle: normalizeHandle(segments[0]!) };
    }
    return null;
  }

  if (platform === "tiktok") {
    // /@{handle}/video/{id} または /@{handle}
    const handleSeg = segments.find((s) => s.startsWith("@"));
    if (handleSeg) {
      const idx = segments.indexOf(handleSeg);
      if (segments[idx + 1] === "video" && segments[idx + 2]) {
        return { platform, type: "post", handle: normalizeHandle(handleSeg), postId: segments[idx + 2], postKind: "video" };
      }
      return { platform, type: "profile", handle: normalizeHandle(handleSeg) };
    }
    return null;
  }

  // instagram: /p/{code}, /reel/{code}, /{handle}
  if (segments[0] === "p" || segments[0] === "reel" || segments[0] === "tv") {
    return segments[1] ? { platform, type: "post", postId: segments[1], postKind: segments[0] === "p" ? "post" : segments[0] } : null;
  }
  if (segments.length >= 1 && !["explore", "accounts", "direct"].includes(segments[0]!)) {
    return { platform, type: "profile", handle: normalizeHandle(segments[0]!) };
  }
  return null;
}

/**
 * URL がソーシャルのプロフィール / 投稿 URL かを判定する。
 *
 * @param url URL
 * @returns 対応プラットフォームの URL なら true
 */
export function isSocialUrl(url: string): boolean {
  return parseSocialUrl(url) !== null;
}
