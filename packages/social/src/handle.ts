/**
 * ソーシャルのハンドル(ユーザー名)処理(純ロジック)。
 * @ の正規化、プラットフォーム別の妥当性判定、プロフィール URL の生成。
 * @packageDocumentation
 */
import { type SocialPlatform, PLATFORMS } from "./platforms.js";

/** 先頭の @・URL 断片・空白を除いた素のハンドルにする。 */
export function normalizeHandle(handle: string): string {
  return handle.trim().replace(/^@+/, "").replace(/\/+$/, "");
}

/** 比較用の正規化(小文字化)。X/TikTok/Instagram はユーザー名の大文字小文字を区別しない。 */
export function canonicalHandle(handle: string): string {
  return normalizeHandle(handle).toLowerCase();
}

/** プラットフォームの規則に照らしてハンドルが妥当か。 */
export function isValidHandle(platform: SocialPlatform, handle: string): boolean {
  const h = normalizeHandle(handle);
  return PLATFORMS[platform].handlePattern.test(h);
}

/** ハンドルを表示形式にする(TikTok は @ 付き)。 */
export function displayHandle(platform: SocialPlatform, handle: string): string {
  return PLATFORMS[platform].handlePrefix + normalizeHandle(handle);
}

/** ハンドルからプロフィール URL を作る。妥当でなければ null。 */
export function buildProfileUrl(platform: SocialPlatform, handle: string): string | null {
  const h = normalizeHandle(handle);
  if (!isValidHandle(platform, h)) return null;
  const spec = PLATFORMS[platform];
  return `${spec.profileBase}/${spec.handlePrefix}${h}`;
}
