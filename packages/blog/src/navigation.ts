/**
 * 記事ナビゲーション(純ロジック)。
 * 公開日順での前後記事、連載(シリーズ)内の順序と前後、目次的な一覧を提供する。
 * @packageDocumentation
 */
import { type BlogPost, publishedPosts } from "./post.js";

/** 前後の記事。 */
export interface AdjacentPosts<T> {
  /** 新しい方(次に読む・prev より後に公開)。 */
  newer: T | null;
  /** 古い方(前に公開)。 */
  older: T | null;
}

/**
 * 指定記事の前後(公開日順)を返す。
 * newer=1つ新しい記事, older=1つ古い記事。公開記事のみ対象。
 *
 * @param posts 記事の配列
 * @param current 現在の記事
 * @param now 判定する時点(テスト注入用)
 * @returns 前後の記事(**公開日順**。連載の順番で辿るなら seriesNavigation を使う)
 */
export function adjacentPosts<T extends BlogPost>(posts: T[], currentId: string, now?: Date): AdjacentPosts<T> {
  const sorted = publishedPosts(posts, now); // 新しい順
  const idx = sorted.findIndex((p) => p.id === currentId);
  if (idx === -1) return { newer: null, older: null };
  return {
    newer: idx > 0 ? sorted[idx - 1]! : null,
    older: idx < sorted.length - 1 ? sorted[idx + 1]! : null,
  };
}

/** 連載(シリーズ)を持つ記事。 */
export interface SeriesPost extends BlogPost {
  /** 連載名。 */
  series?: string;
  /** 連載内の順番(小さいほど先)。 */
  seriesOrder?: number;
}

/**
 * 連載の記事を順番どおりに返す。
 *
 * **公開記事のみ**。連載の途中に下書きがあっても、読者には見せない。
 *
 * @param posts 記事の配列
 * @param series 連載名
 * @param now 判定する時点(テスト注入用)
 * @returns 連載の記事(順番どおり)
 */
export function seriesPosts<T extends SeriesPost>(posts: T[], series: string, now?: Date): T[] {
  return publishedPosts(posts, now)
    .filter((p) => p.series === series)
    .sort((a, b) => (a.seriesOrder ?? 0) - (b.seriesOrder ?? 0));
}

/**
 * 連載内の前後の記事を返す。
 *
 * **公開日ではなく連載の順番**で決める(後から書いた第 1 話が「次」になっては困る)。
 *
 * @param posts 記事の配列
 * @param current 現在の記事
 * @param now 判定する時点(テスト注入用)
 * @returns 前後の記事(**端なら undefined**)
 */
export function seriesNavigation<T extends SeriesPost>(posts: T[], currentId: string, now?: Date): { prev: T | null; next: T | null; index: number; total: number } {
  const current = posts.find((p) => p.id === currentId);
  if (!current?.series) return { prev: null, next: null, index: -1, total: 0 };
  const ordered = seriesPosts(posts, current.series, now);
  const idx = ordered.findIndex((p) => p.id === currentId);
  return {
    prev: idx > 0 ? ordered[idx - 1]! : null,
    next: idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1]! : null,
    index: idx,
    total: ordered.length,
  };
}
