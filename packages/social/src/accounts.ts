/**
 * キャストのソーシャルアカウント集合(純ロジック)。
 * 貼り付けられた URL 群からアカウント一覧を作り、正規化・重複排除・リンク生成を行う。
 * @packageDocumentation
 */
import { type SocialPlatform, ALL_PLATFORMS } from "./platforms.js";
import { normalizeHandle, canonicalHandle, isValidHandle, buildProfileUrl, displayHandle } from "./handle.js";
import { parseSocialUrl } from "./parse.js";

/** 1 アカウント。 */
export interface SocialAccount {
  platform: SocialPlatform;
  /** 素のハンドル(@ なし)。 */
  handle: string;
  /** 正規化されたプロフィール URL。 */
  url: string;
}

/** プラットフォームとハンドルからアカウントを作る(妥当なら)。 */
export function makeAccount(platform: SocialPlatform, handle: string): SocialAccount | null {
  const h = normalizeHandle(handle);
  const url = buildProfileUrl(platform, h);
  if (!url) return null;
  return { platform, handle: h, url };
}

/** プロフィール URL からアカウントを作る。 */
export function accountFromUrl(url: string): SocialAccount | null {
  const parsed = parseSocialUrl(url);
  if (!parsed?.handle) return null;
  return makeAccount(parsed.platform, parsed.handle);
}

/**
 * 貼り付けられた URL/ハンドルの配列からアカウント一覧を作る。
 * 妥当でないものは除外し、同一(プラットフォーム+ハンドル)は重複排除する。
 */
export function accountsFromUrls(urls: string[]): SocialAccount[] {
  const seen = new Set<string>();
  const out: SocialAccount[] = [];
  for (const url of urls) {
    const account = accountFromUrl(url);
    if (!account) continue;
    const key = `${account.platform}:${canonicalHandle(account.handle)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(account);
  }
  return out;
}

/** アカウント配列を重複排除する(プラットフォーム+ハンドルの正規化キー)。 */
export function dedupeAccounts(accounts: SocialAccount[]): SocialAccount[] {
  const seen = new Set<string>();
  return accounts.filter((a) => {
    const key = `${a.platform}:${canonicalHandle(a.handle)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** アカウント一覧をプラットフォーム順(x→tiktok→instagram)に並べる。 */
export function sortAccounts(accounts: SocialAccount[]): SocialAccount[] {
  return [...accounts].sort((a, b) => ALL_PLATFORMS.indexOf(a.platform) - ALL_PLATFORMS.indexOf(b.platform));
}

/** 表示用リンク一覧({プラットフォーム, ラベル(@handle), URL})を作る。 */
export function accountLinks(accounts: SocialAccount[]): { platform: SocialPlatform; label: string; url: string }[] {
  return sortAccounts(accounts).map((a) => ({ platform: a.platform, label: displayHandle(a.platform, a.handle), url: a.url }));
}

/** 各プラットフォームのアカウントを 1 つずつ持つ形(プロフィール編集フォーム用)に変換する。 */
export function accountsByPlatform(accounts: SocialAccount[]): Partial<Record<SocialPlatform, SocialAccount>> {
  const map: Partial<Record<SocialPlatform, SocialAccount>> = {};
  for (const a of accounts) if (!map[a.platform]) map[a.platform] = a;
  return map;
}
