/**
 * ソーシャル投稿の統合フィード(純ロジック)。
 * 各プラットフォームから取得した投稿を 1 つのタイムラインにまとめる。並び替え・重複排除・
 * プラットフォーム別集計。実際の取得(fetch)は @platform/integrations + @platform/jobs で定期実行し、
 * その結果をこの形に正規化して使う。
 * @packageDocumentation
 */
import { type SocialPlatform } from "./platforms.js";

/** 統合された 1 投稿。 */
export interface SocialPost {
  platform: SocialPlatform;
  /** プラットフォーム内の投稿 ID。 */
  id: string;
  /** 投稿 URL。 */
  url: string;
  /** 本文(あれば)。 */
  text?: string;
  /** サムネイル画像 URL。 */
  thumbnail?: string;
  /** 投稿日時(ISO 8601)。 */
  createdAt: string;
  /** 投稿の種類(post/video/reel など)。 */
  kind?: string;
  /** いいね数など(あれば)。 */
  likeCount?: number;
  [key: string]: unknown;
}

/** 投稿の一意キー(プラットフォーム + ID)。 */
export function postKey(post: Pick<SocialPost, "platform" | "id">): string {
  return `${post.platform}:${post.id}`;
}

/**
 * 複数プラットフォームの投稿を統合タイムラインにまとめる(新しい順・重複排除)。
 */
export function mergeSocialFeed(posts: SocialPost[]): SocialPost[] {
  const seen = new Set<string>();
  const unique: SocialPost[] = [];
  for (const p of posts) {
    const key = postKey(p);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(p);
  }
  return unique.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** プラットフォームで絞り込む。 */
export function filterByPlatform(posts: SocialPost[], platform: SocialPlatform): SocialPost[] {
  return posts.filter((p) => p.platform === platform);
}

/** プラットフォームごとにグループ化する。 */
export function groupByPlatform(posts: SocialPost[]): Partial<Record<SocialPlatform, SocialPost[]>> {
  const map: Partial<Record<SocialPlatform, SocialPost[]>> = {};
  for (const p of posts) (map[p.platform] ??= []).push(p);
  return map;
}

/** 各プラットフォームの最新投稿を 1 件ずつ返す(新しい順)。 */
export function latestPerPlatform(posts: SocialPost[]): SocialPost[] {
  const merged = mergeSocialFeed(posts);
  const seen = new Set<SocialPlatform>();
  const out: SocialPost[] = [];
  for (const p of merged) {
    if (seen.has(p.platform)) continue;
    seen.add(p.platform);
    out.push(p);
  }
  return out;
}

/**
 * 前回取得済みの投稿を除いた新着だけを返す(差分取得・通知用)。
 * @param knownKeys 既知の postKey 集合
 */
export function newPosts(posts: SocialPost[], knownKeys: Iterable<string>): SocialPost[] {
  const known = new Set(knownKeys);
  return mergeSocialFeed(posts.filter((p) => !known.has(postKey(p))));
}

/** 直近 N 件を返す(統合・新しい順)。 */
export function recentPosts(posts: SocialPost[], limit: number): SocialPost[] {
  return mergeSocialFeed(posts).slice(0, limit);
}
