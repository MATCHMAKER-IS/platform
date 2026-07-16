/**
 * FAQ のデータアクセス。**Prisma 実装とメモリ実装を持つ**。
 *
 * - `FAQ_PERSISTENCE=prisma`: DB に保存(再起動しても残る)
 * - それ以外(既定): メモリ + seed(DB 不要ですぐ試せる)
 *
 * ロジックは `@platform/faq` の担当。ここは保存と取り出しだけ。
 * @packageDocumentation
 */
import { randomUUID } from "node:crypto";
import type { FaqItem, FaqStatus } from "@platform/faq";
import { db } from "./services";
import { featureEnv } from "./env";

/** 保存先。 */
export interface FaqStore {
  list(): Promise<FaqItem[]>;
  get(id: string): Promise<FaqItem | undefined>;
  create(input: { question: string; answer: string; category: string; keywords?: string[] }): Promise<FaqItem>;
  update(id: string, patch: Partial<FaqItem>): Promise<FaqItem | undefined>;
  /** 閲覧数を 1 増やす(検索経由で開かれたとき)。 */
  incrementViews(id: string): Promise<void>;
}

/** メモリ実装(開発・評価用。再起動で消える)。 */
export function createMemoryFaqStore(seed: FaqItem[] = []): FaqStore {
  const items = new Map<string, FaqItem>(seed.map((i) => [i.id, i]));
  return {
    async list() {
      return [...items.values()];
    },
    async get(id) {
      return items.get(id);
    },
    async create(input) {
      const now = new Date().toISOString();
      const item: FaqItem = {
        id: randomUUID(),
        question: input.question,
        answer: input.answer,
        category: input.category,
        keywords: input.keywords ?? [],
        status: "draft",
        helpful: 0,
        notHelpful: 0,
        views: 0,
        relatedIds: [],
        createdAt: now,
        updatedAt: now,
      };
      items.set(item.id, item);
      return item;
    },
    async update(id, patch) {
      const cur = items.get(id);
      if (!cur) return undefined;
      const next: FaqItem = { ...cur, ...patch, id: cur.id, updatedAt: new Date().toISOString() };
      items.set(id, next);
      return next;
    },
    async incrementViews(id) {
      const cur = items.get(id);
      if (cur) items.set(id, { ...cur, views: cur.views + 1 });
    },
  };
}

/** Prisma の Faq 行(生成型の必要部分)。 */
export interface PrismaFaqRow {
  id: string;
  question: string;
  answer: string;
  category: string;
  keywords: string[];
  status: string;
  helpful: number;
  notHelpful: number;
  views: number;
  relatedIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Prisma 行 → アプリの FaqItem。
 *
 * @param row Prisma が返す行
 * @returns アプリで扱う {@link FaqItem}(日時は ISO 文字列)
 */
export function prismaFaqToItem(row: PrismaFaqRow): FaqItem {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    category: row.category,
    keywords: row.keywords,
    status: row.status as FaqStatus,
    helpful: row.helpful,
    notHelpful: row.notHelpful,
    views: row.views,
    relatedIds: row.relatedIds,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Prisma 実装(本番用)。 */
export function createPrismaFaqStore(): FaqStore {
  const model = (db as unknown as { faq: {
    findMany(a?: unknown): Promise<PrismaFaqRow[]>;
    findUnique(a: unknown): Promise<PrismaFaqRow | null>;
    create(a: unknown): Promise<PrismaFaqRow>;
    update(a: unknown): Promise<PrismaFaqRow>;
  } }).faq;

  return {
    async list() {
      return (await model.findMany({ orderBy: { createdAt: "desc" } })).map(prismaFaqToItem);
    },
    async get(id) {
      const row = await model.findUnique({ where: { id } });
      return row ? prismaFaqToItem(row) : undefined;
    },
    async create(input) {
      const row = await model.create({
        data: {
          question: input.question,
          answer: input.answer,
          category: input.category,
          keywords: input.keywords ?? [],
        },
      });
      return prismaFaqToItem(row);
    },
    async update(id, patch) {
      try {
        const row = await model.update({
          where: { id },
          data: {
            ...(patch.question !== undefined ? { question: patch.question } : {}),
            ...(patch.answer !== undefined ? { answer: patch.answer } : {}),
            ...(patch.category !== undefined ? { category: patch.category } : {}),
            ...(patch.keywords !== undefined ? { keywords: patch.keywords } : {}),
            ...(patch.status !== undefined ? { status: patch.status } : {}),
            ...(patch.helpful !== undefined ? { helpful: patch.helpful } : {}),
            ...(patch.notHelpful !== undefined ? { notHelpful: patch.notHelpful } : {}),
          },
        });
        return prismaFaqToItem(row);
      } catch {
        return undefined; // 無い id は undefined(呼び出し側で 404 に)
      }
    },
    async incrementViews(id) {
      try {
        await model.update({ where: { id }, data: { views: { increment: 1 } } });
      } catch {
        // 無い id は黙って無視(閲覧数の記録で処理を止めない)
      }
    },
  };
}

/** 動かして確かめられるよう、最初から入れておく。 */
function seedFaq(): FaqItem[] {
  const now = new Date().toISOString();
  const mk = (id: string, question: string, answer: string, category: string, o: Partial<FaqItem> = {}): FaqItem => ({
    id, question, answer, category, keywords: [], status: "published",
    helpful: 0, notHelpful: 0, views: 0, relatedIds: [], createdAt: now, updatedAt: now, ...o,
  });
  return [
    mk("f1", "経費の締め切りはいつですか?", "毎月 5 日までに申請してください。5 日が休日の場合は翌営業日です。", "経費",
      { keywords: ["精算", "期限", "締日"], helpful: 24, notHelpful: 2, views: 180 }),
    mk("f2", "領収書を無くしてしまいました", "支払先に再発行を依頼してください。難しい場合は「支払証明書」を経理に提出します。", "経費",
      { keywords: ["レシート", "紛失"], helpful: 12, notHelpful: 1, views: 90 }),
    mk("f3", "有給休暇の申請方法を教えてください", "勤怠画面から「休暇申請」を選び、日付と理由を入力して提出します。上長の承認後に確定します。", "勤怠",
      { keywords: ["休暇", "年休"], helpful: 18, notHelpful: 0, views: 140 }),
    mk("f4", "パスワードを忘れました", "ログイン画面の「パスワードを忘れた方」から再設定できます。", "システム",
      { keywords: ["ログイン", "リセット"], helpful: 8, notHelpful: 6, views: 75 }),
    mk("f5", "経費の上限はありますか?", "(古い情報)", "経費",
      { keywords: [], helpful: 1, notHelpful: 11, views: 60 }),
    mk("f6", "在宅勤務の申請は必要ですか?", "毎回の申請は不要です。月初にまとめて予定を登録してください。", "勤怠",
      { keywords: ["リモート", "テレワーク"], views: 55 }),
    mk("f7", "新しい経費科目を追加したい", "(作成中)", "経費", { status: "draft" }),
  ];
}

/**
 * アプリで共有するストア。
 * `FAQ_PERSISTENCE=prisma` なら DB、それ以外はメモリ(seed 付き)。
 */
export const faqStore: FaqStore = featureEnv.FAQ_PERSISTENCE === "prisma"
  ? createPrismaFaqStore()
  : createMemoryFaqStore(seedFaq());
