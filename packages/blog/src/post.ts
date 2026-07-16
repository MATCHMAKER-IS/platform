/**
 * 記事の公開状態・絞り込み・関連記事(純ロジック)。
 * 下書き/公開/予約公開の判定、タグ・カテゴリでの絞り込み、公開日順の並び替え、関連記事の抽出。
 * 保存はアプリ側。ここは記事配列を受け取り加工するだけ。
 * @packageDocumentation
 */

/** 記事の公開ステータス。 */
export type PostStatus = "draft" | "published" | "scheduled";

/** ブログ記事(基盤が扱う最小限のフィールド)。 */
export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  status: PostStatus;
  /** 公開日時(ISO 8601)。scheduled はこの時刻に公開扱いになる。 */
  publishedAt?: string;
  tags?: string[];
  category?: string;
  [key: string]: unknown;
}

/**
 * 指定時点で公開済みかを判定する。
 *
 * **`status` をそのまま信じない**。予約公開(scheduled)は、日時を過ぎたら公開扱いにする
 * 必要がある(DB を書き換えるバッチが動いていなくても、読む側で正しく判定する)。
 *
 * @param post 記事
 * @param now 判定する時点(テスト注入用)
 * @returns 公開済みなら true
 */
export function isPublished(post: BlogPost, now: Date = new Date()): boolean {
  if (post.status === "draft") return false;
  if (!post.publishedAt) return post.status === "published";
  return new Date(post.publishedAt).getTime() <= now.getTime();
}

/**
 * 公開済みの記事だけを、公開日の新しい順で返す。
 *
 * **一覧を返す前に必ず通す**。下書きが漏れると事故になる。
 *
 * @param posts 記事の配列
 * @param now 判定する時点(テスト注入用)
 * @returns 公開済みの記事(新しい順)
 */
export function publishedPosts<T extends BlogPost>(posts: T[], now: Date = new Date()): T[] {
  return posts
    .filter((p) => isPublished(p, now))
    .sort((a, b) => new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime());
}

/**
 * タグで絞り込む(**いずれかを含む** = OR 条件)。
 *
 * @param posts 記事の配列
 * @param tags 絞り込むタグ
 * @returns いずれかのタグを持つ記事
 */
export function postsByTag<T extends BlogPost>(posts: T[], tag: string): T[] {
  return posts.filter((p) => p.tags?.includes(tag));
}

/**
 * カテゴリで絞り込む。
 *
 * @param posts 記事の配列
 * @param category カテゴリ
 * @returns そのカテゴリの記事
 */
export function postsByCategory<T extends BlogPost>(posts: T[], category: string): T[] {
  return posts.filter((p) => p.category === category);
}

/**
 * タグの出現数を集計する(タグクラウド用)。
 *
 * @param posts 記事の配列
 * @returns タグと件数(**多い順**)
 */
export function tagCounts(posts: BlogPost[]): { tag: string; count: number }[] {
  const map = new Map<string, number>();
  for (const p of posts) for (const t of p.tags ?? []) map.set(t, (map.get(t) ?? 0) + 1);
  return [...map.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
}

/**
 * 関連記事を抽出する(共有タグ数の多い順)。自身は除外。
 * @param limit 返す最大件数
 * @returns 関連記事(**タグの一致数が多い順**。自分自身は含まない)
 */
export function relatedPosts<T extends BlogPost>(target: BlogPost, posts: T[], limit = 5): T[] {
  const targetTags = new Set(target.tags ?? []);
  if (targetTags.size === 0) return [];
  return posts
    .filter((p) => p.id !== target.id)
    .map((p) => ({ post: p, shared: (p.tags ?? []).filter((t) => targetTags.has(t)).length }))
    .filter((x) => x.shared > 0)
    .sort((a, b) => b.shared - a.shared)
    .slice(0, limit)
    .map((x) => x.post);
}
