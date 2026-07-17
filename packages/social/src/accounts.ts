/**
 * キャストのソーシャルアカウント集合(純ロジック)。
 * 貼り付けられた URL 群からアカウント一覧を作り、正規化・重複排除・リンク生成を行う。
 * @packageDocumentation
 */
import { type SocialPlatform, ALL_PLATFORMS } from "./platforms";
import { normalizeHandle, canonicalHandle, buildProfileUrl, displayHandle } from "./handle";
import { parseSocialUrl } from "./parse";

/** 1 アカウント。 */
export interface SocialAccount {
  platform: SocialPlatform;
  /** 素のハンドル(@ なし)。 */
  handle: string;
  /** 正規化されたプロフィール URL。 */
  url: string;
}

/**
 * プラットフォームとハンドルからアカウントを作る。
 *
 * @param platform プラットフォーム
 * @param handle ハンドル(**正規化前でよい**)
 * @returns アカウント。**ハンドルが妥当でなければ null**
 */
export function makeAccount(platform: SocialPlatform, handle: string): SocialAccount | null {
  const h = normalizeHandle(handle);
  const url = buildProfileUrl(platform, h);
  if (!url) return null;
  return { platform, handle: h, url };
}

/**
 * プロフィール URL からアカウントを作る。
 *
 * **利用者は URL を貼ることが多い**(ハンドルだけ入力させるより親切)。
 *
 * @param url プロフィール URL
 * @returns アカウント。**解釈できなければ null**
 */
export function accountFromUrl(url: string): SocialAccount | null {
  const parsed = parseSocialUrl(url);
  if (!parsed?.handle) return null;
  return makeAccount(parsed.platform, parsed.handle);
}

/**
 * 貼り付けられた URL/ハンドルの配列からアカウント一覧を作る。
 * 妥当でないものは除外し、同一(プラットフォーム+ハンドル)は重複排除する。
 *
 * @param urls プロフィール URL の配列
 * @returns アカウントの配列(**解釈できない URL は除外**。エラーにせず、分かる分だけ返す)
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

/**
 * アカウントの重複を除く。
 *
 * **正規化して比較する**ので、`@Name` と `@name` は同じものとして扱う。
 *
 * @param accounts アカウントの配列
 * @returns 重複を除いた配列(**先に現れたものを残す**)
 */
export function dedupeAccounts(accounts: SocialAccount[]): SocialAccount[] {
  const seen = new Set<string>();
  return accounts.filter((a) => {
    const key = `${a.platform}:${canonicalHandle(a.handle)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * アカウントをプラットフォーム順に並べる。
 *
 * **表示順を固定する**ため(データの入力順に出すと、ページごとに順序が変わって落ち着かない)。
 *
 * @param accounts アカウントの配列
 * @returns 並べ替えた配列(x → tiktok → instagram)
 */
export function sortAccounts(accounts: SocialAccount[]): SocialAccount[] {
  return [...accounts].sort((a, b) => ALL_PLATFORMS.indexOf(a.platform) - ALL_PLATFORMS.indexOf(b.platform));
}

/**
 * 表示用のリンク一覧を作る。
 *
 * @param accounts アカウントの配列
 * @returns プラットフォーム・ラベル・URL の配列(**そのまま描画できる形**)
 */
export function accountLinks(accounts: SocialAccount[]): { platform: SocialPlatform; label: string; url: string }[] {
  return sortAccounts(accounts).map((a) => ({ platform: a.platform, label: displayHandle(a.platform, a.handle), url: a.url }));
}

/**
 * 各プラットフォームのアカウントを 1 つずつ持つ形に変換する(プロフィール編集フォーム用)。
 *
 * **フォームは 1 プラットフォーム 1 欄**なので、配列のままでは扱いにくい。
 *
 * @param accounts アカウントの配列
 * @returns プラットフォーム → アカウント。**同じプラットフォームが複数あれば最初の 1 つ**
 */
export function accountsByPlatform(accounts: SocialAccount[]): Partial<Record<SocialPlatform, SocialAccount>> {
  const map: Partial<Record<SocialPlatform, SocialAccount>> = {};
  for (const a of accounts) if (!map[a.platform]) map[a.platform] = a;
  return map;
}
