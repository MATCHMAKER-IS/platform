/**
 * ソーシャルプラットフォーム定義(純ロジック)。
 * X(Twitter)・TikTok・Instagram のハンドル規則・URL 形式・ホスト名をまとめる。
 * @packageDocumentation
 */

/** 対応プラットフォーム。 */
export type SocialPlatform = "x" | "tiktok" | "instagram";

/** プラットフォームの定義。 */
export interface PlatformSpec {
  /** 識別子。 */
  platform: SocialPlatform;
  /** 表示名。 */
  label: string;
  /** プロフィール URL の起点(末尾スラッシュなし)。 */
  profileBase: string;
  /** ハンドルに @ を前置するか(TikTok は付ける)。 */
  handlePrefix: string;
  /** ハンドルの妥当性を判定する正規表現(@ を除いた部分)。 */
  handlePattern: RegExp;
  /** このプラットフォームとみなすホスト名(サブドメイン除く登録可能ドメイン)。 */
  hostnames: string[];
}

/** 各プラットフォームの定義。 */
export const PLATFORMS: Record<SocialPlatform, PlatformSpec> = {
  x: {
    platform: "x",
    label: "X",
    profileBase: "https://x.com",
    handlePrefix: "",
    handlePattern: /^[A-Za-z0-9_]{1,15}$/,
    hostnames: ["x.com", "twitter.com"],
  },
  tiktok: {
    platform: "tiktok",
    label: "TikTok",
    profileBase: "https://www.tiktok.com",
    handlePrefix: "@",
    handlePattern: /^[A-Za-z0-9_.]{2,24}$/,
    hostnames: ["tiktok.com"],
  },
  instagram: {
    platform: "instagram",
    label: "Instagram",
    profileBase: "https://www.instagram.com",
    handlePrefix: "",
    handlePattern: /^[A-Za-z0-9_.]{1,30}$/,
    hostnames: ["instagram.com"],
  },
};

/** 全プラットフォームの一覧。 */
export const ALL_PLATFORMS: SocialPlatform[] = ["x", "tiktok", "instagram"];

/** ホスト名(登録可能ドメイン)からプラットフォームを判定する。 */
export function platformFromHostname(hostname: string): SocialPlatform | null {
  const host = hostname.toLowerCase().replace(/^www\./, "").replace(/^(vm|mobile|m)\./, "");
  for (const spec of Object.values(PLATFORMS)) {
    if (spec.hostnames.includes(host)) return spec.platform;
  }
  return null;
}
