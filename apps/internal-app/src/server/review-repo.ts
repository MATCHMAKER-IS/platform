/**
 * 口コミ（レビュー）。対象（取引先・商品など任意）に対する評価（1〜5）とコメントを収集・集計する。
 * 集計は @platform/commerce の ratingSummary を利用する。
 * @packageDocumentation
 */
import { ratingSummary, type RatingSummary } from "@platform/commerce";

/** レビュー。 */
export interface Review {
  id: string;
  /** 対象の種類（例 "partner", "product"）。 */
  subjectType: string;
  /** 対象の識別子。 */
  subjectId: string;
  author: string;
  rating: number;
  title: string;
  comment: string;
  /** モデレーションで非表示にされたか。 */
  hidden: boolean;
  createdAt: string;
}

/** レビュー投稿の入力。 */
export interface ReviewInput {
  subjectType: string;
  subjectId: string;
  author: string;
  rating: number;
  title?: string;
  comment?: string;
}

/** 対象ごとの集計（件数・平均・分布）。 */
export interface ReviewSummary extends RatingSummary {
  subjectType: string;
  subjectId: string;
}

/** レビュー配列から集計を作る。 */
export function summarizeReviews(subjectType: string, subjectId: string, reviews: Review[]): ReviewSummary {
  const visible = reviews.filter((r) => !r.hidden);
  return { subjectType, subjectId, ...ratingSummary(visible.map((r) => r.rating)) };
}

/** 評価を 1〜5 に丸める。 */
export function clampRating(n: number): number {
  const r = Math.round(n);
  return r < 1 ? 1 : r > 5 ? 5 : r;
}

/** レビューストア。 */
export interface ReviewStore {
  /** 対象のレビュー一覧。既定は可視のみ。includeHidden=true で非表示も含む（モデレーション用）。 */
  list(subjectType: string, subjectId: string, includeHidden?: boolean): Promise<Review[]>;
  add(input: ReviewInput): Promise<Review>;
  /** レビューの表示/非表示を切り替える。 */
  setHidden(id: string, hidden: boolean): Promise<void>;
}

let memSeq = 0;

/** インメモリ実装。 */
export function createMemoryReviewStore(): ReviewStore {
  const items: Review[] = [];
  return {
    async list(subjectType, subjectId, includeHidden = false) {
      return items.filter((r) => r.subjectType === subjectType && r.subjectId === subjectId && (includeHidden || !r.hidden)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map((r) => ({ ...r }));
    },
    async add(input) {
      const review: Review = { id: `rv${memSeq++}`, subjectType: input.subjectType, subjectId: input.subjectId, author: input.author, rating: clampRating(input.rating), title: input.title ?? "", comment: input.comment ?? "", hidden: false, createdAt: new Date().toISOString() };
      items.push(review);
      return { ...review };
    },
    async setHidden(id, hidden) {
      const r = items.find((x) => x.id === id);
      if (r) r.hidden = hidden;
    },
  };
}

// ── Prisma 実装 ──

/** ReviewRow の必要部分。 */
export interface ReviewRow {
  id: string;
  subjectType: string;
  subjectId: string;
  author: string;
  rating: number;
  title: string;
  comment: string;
  hidden: boolean;
  createdAt: string;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface ReviewStoreDb {
  reviewRow: {
    findMany(args: { where: { subjectType: string; subjectId: string; hidden?: boolean }; orderBy: { createdAt: "desc" } }): Promise<ReviewRow[]>;
    create(args: { data: { subjectType: string; subjectId: string; author: string; rating: number; title: string; comment: string; hidden: boolean; createdAt: string } }): Promise<ReviewRow>;
    update(args: { where: { id: string }; data: { hidden: boolean } }): Promise<ReviewRow>;
  };
}

const rowToReview = (row: ReviewRow): Review => ({ id: row.id, subjectType: row.subjectType, subjectId: row.subjectId, author: row.author, rating: row.rating, title: row.title, comment: row.comment, hidden: row.hidden, createdAt: row.createdAt });

/** Prisma 実装。 */
export function createPrismaReviewStore(db: ReviewStoreDb): ReviewStore {
  return {
    async list(subjectType, subjectId, includeHidden = false) {
      const where = includeHidden ? { subjectType, subjectId } : { subjectType, subjectId, hidden: false };
      return (await db.reviewRow.findMany({ where, orderBy: { createdAt: "desc" } })).map(rowToReview);
    },
    async add(input) {
      const row = await db.reviewRow.create({ data: { subjectType: input.subjectType, subjectId: input.subjectId, author: input.author, rating: clampRating(input.rating), title: input.title ?? "", comment: input.comment ?? "", hidden: false, createdAt: new Date().toISOString() } });
      return rowToReview(row);
    },
    async setHidden(id, hidden) {
      await db.reviewRow.update({ where: { id }, data: { hidden } });
    },
  };
}
