/**
 * ソーシャルのハンドル(ユーザー名)処理(純ロジック)。
 * @ の正規化、プラットフォーム別の妥当性判定、プロフィール URL の生成。
 * @packageDocumentation
 */
import { type SocialPlatform, PLATFORMS } from "./platforms";

/**
 * ハンドルを素の形にする(先頭の `@`・URL 断片・空白を除く)。
 *
 * **利用者は色々な形で入力する**(`@name`、`https://x.com/name`、` name `)。
 * 保存・比較の前に必ず通す。
 *
 * @param input 入力されたハンドル
 * @returns 素のハンドル
 */
export function normalizeHandle(handle: string): string {
  return handle.trim().replace(/^@+/, "").replace(/\/+$/, "");
}

/**
 * 比較用に正規化する(小文字化)。
 *
 * **X / TikTok / Instagram は大文字小文字を区別しない**ので、`@Name` と `@name` は
 * 同じアカウント。重複判定の前に通す。
 *
 * @param handle ハンドル
 * @returns 正規化したハンドル
 */
export function canonicalHandle(handle: string): string {
  return normalizeHandle(handle).toLowerCase();
}

/**
 * ハンドルが妥当かを判定する(**プラットフォームごとに規則が違う**)。
 *
 * X は 15 文字まで、Instagram は 30 文字まで、使える記号も違う。
 *
 * @param platform プラットフォーム
 * @param handle ハンドル
 * @returns 妥当なら true
 */
export function isValidHandle(platform: SocialPlatform, handle: string): boolean {
  const h = normalizeHandle(handle);
  return PLATFORMS[platform].handlePattern.test(h);
}

/**
 * ハンドルを表示形式にする。
 *
 * **TikTok は `@` 付きが正式**(他は付けない)。プラットフォームの慣習に合わせる。
 *
 * @param platform プラットフォーム
 * @param handle ハンドル
 * @returns 表示用の文字列
 */
export function displayHandle(platform: SocialPlatform, handle: string): string {
  return PLATFORMS[platform].handlePrefix + normalizeHandle(handle);
}

/**
 * ハンドルからプロフィール URL を作る。
 *
 * @param platform プラットフォーム
 * @param handle ハンドル
 * @returns プロフィール URL。**ハンドルが妥当でなければ null**(壊れたリンクを作らない)
 */
export function buildProfileUrl(platform: SocialPlatform, handle: string): string | null {
  const h = normalizeHandle(handle);
  if (!isValidHandle(platform, h)) return null;
  const spec = PLATFORMS[platform];
  return `${spec.profileBase}/${spec.handlePrefix}${h}`;
}
