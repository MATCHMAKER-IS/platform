/**
 * 社内 FAQ の純ロジック(質問と回答・カテゴリ・検索・役に立った投票)。
 *
 * 記事の管理(`@platform/cms`)とは別物。FAQ は「困っている人が答えを探す」ためのもので、
 * **検索されやすさ**と**どれが役に立っているか**が要になる。
 *
 * 全文検索は `@platform/search`(BM25)に委譲できる形にしてある(ここは索引を作らない)。
 * @packageDocumentation
 */
import { AppError, ErrorCode } from "@platform/core";

/** 公開状態。 */
export type FaqStatus = "draft" | "published" | "archived";

/** FAQ 1 件。 */
export interface FaqItem {
  id: string;
  /** 質問(利用者が検索する言葉で書く)。 */
  question: string;
  /** 回答(Markdown 可)。 */
  answer: string;
  /** カテゴリ(「経費」「勤怠」など)。 */
  category: string;
  /** 別の言い方・略語。検索でヒットさせるため。 */
  keywords: string[];
  status: FaqStatus;
  /** 役に立った票。 */
  helpful: number;
  /** 役に立たなかった票。 */
  notHelpful: number;
  /** 閲覧数。 */
  views: number;
  /** 関連する FAQ の id。 */
  relatedIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** 検索の結果 1 件。 */
export interface FaqHit {
  item: FaqItem;
  /** 一致した理由(質問 / キーワード / 回答)。 */
  matched: string;
  /** 並べ替え用のスコア。 */
  score: number;
}

/**
 * 公開中の FAQ だけに絞る。
 *
 * **下書き・アーカイブを利用者に見せない**ため、一覧・検索の前に必ず通す。
 *
 * @param items 対象の FAQ
 * @returns `published` のものだけ
 */
export function publishedOnly(items: FaqItem[]): FaqItem[] {
  return items.filter((i) => i.status === "published");
}

/**
 * キーワードで検索する。
 *
 * 質問文の一致を最優先し、次にキーワード、最後に回答本文を見る
 * (「質問がそのまま一致する」のが最も確度が高いため)。
 * **公開中のものだけ**が対象。
 *
 * @param items 対象の FAQ(下書きが混ざっていてもよい。内部で絞る)
 * @param query 検索語(空白区切りで AND ではなく、それぞれで加点する)
 * @param limit 最大件数(既定 10)
 * @returns スコアの高い順。該当なしは空配列
 *
 * @example
 * ```ts
 * searchFaq(items, "経費 締め切り");
 * // => [{ item: {...}, matched: "質問", score: 60 }, ...]
 * ```
 */
export function searchFaq(items: FaqItem[], query: string, limit = 10): FaqHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  const hits: FaqHit[] = [];

  for (const item of publishedOnly(items)) {
    let score = 0;
    let matched = "";
    const question = item.question.toLowerCase();
    const answer = item.answer.toLowerCase();
    const keywords = item.keywords.map((k) => k.toLowerCase());

    for (const term of terms) {
      if (question.includes(term)) { score += 30; matched = matched || "質問"; }
      if (keywords.some((k) => k.includes(term))) { score += 20; matched = matched || "キーワード"; }
      if (answer.includes(term)) { score += 5; matched = matched || "回答"; }
    }
    if (score === 0) continue;
    // 役に立った FAQ を上げる(同じくらい一致するなら、評価の高い方を先に見せる)
    score += Math.min(10, item.helpful);
    hits.push({ item, matched, score });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * カテゴリ別にまとめる。
 *
 * @param items 対象の FAQ(公開中のものだけを内部で絞る)
 * @returns カテゴリ名と、その中の FAQ(役に立った順)。**件数の多いカテゴリが先**
 */
export function byCategory(items: FaqItem[]): { category: string; items: FaqItem[] }[] {
  const map = new Map<string, FaqItem[]>();
  for (const i of publishedOnly(items)) {
    const list = map.get(i.category) ?? [];
    list.push(i);
    map.set(i.category, list);
  }
  return [...map.entries()]
    .map(([category, list]) => ({ category, items: sortByHelpfulness(list) }))
    .sort((a, b) => b.items.length - a.items.length || a.category.localeCompare(b.category));
}

/**
 * 役に立った順に並べる。
 *
 * **票が少ないものを不当に上げない**ため、単純な「役立った率」ではなく
 * 票数も加味する(1 票で 100% より、50 票で 90% を上に出す)。
 *
 * @param items 対象の FAQ
 * @returns 並べ替えた新しい配列
 */
export function sortByHelpfulness(items: FaqItem[]): FaqItem[] {
  const score = (i: FaqItem): number => {
    const total = i.helpful + i.notHelpful;
    if (total === 0) return 0;
    // ウィルソン得点の簡易版: 票が少ないほど自信を割り引く
    const rate = i.helpful / total;
    return rate * Math.min(1, total / 10);
  };
  return [...items].sort((a, b) => score(b) - score(a) || b.views - a.views);
}

/**
 * 役に立った率を返す。
 *
 * @param item 対象の FAQ
 * @returns 0〜1。**票が 1 つも無ければ undefined**(0% と区別する。まだ分からないだけ)
 */
export function helpfulRate(item: FaqItem): number | undefined {
  const total = item.helpful + item.notHelpful;
  return total === 0 ? undefined : item.helpful / total;
}

/**
 * 見直しが必要な FAQ を挙げる。
 *
 * **役に立っていない FAQ は、無いより悪い**(探した人の時間を奪う)ため、
 * 定期的に見つけて直す。
 *
 * @param items     対象の FAQ
 * @param minVotes  判定に必要な最低票数(既定 5。少ない票で決めつけない)
 * @param threshold この率を下回ったら要見直し(既定 0.5)
 * @returns 要見直しの FAQ と理由
 */
export function needsReview(items: FaqItem[], minVotes = 5, threshold = 0.5): { item: FaqItem; reason: string }[] {
  const out: { item: FaqItem; reason: string }[] = [];
  for (const item of publishedOnly(items)) {
    const total = item.helpful + item.notHelpful;
    const rate = helpfulRate(item);
    if (total >= minVotes && rate !== undefined && rate < threshold) {
      out.push({ item, reason: `役に立った率が ${Math.round(rate * 100)}%(${item.helpful}/${total})。内容が古いか、質問と回答が噛み合っていません` });
    } else if (item.views >= 50 && total === 0) {
      out.push({ item, reason: `${item.views} 回見られていますが投票がありません。答えになっていない可能性があります` });
    }
  }
  return out;
}

/**
 * 投票を反映する。
 *
 * @param item    対象の FAQ
 * @param helpful 役に立ったか
 * @param now     現在時刻(テスト注入用)
 * @returns 票を加算した**新しい** FAQ(元は変更しない)
 * @throws {@link @platform/core#AppError} コード `VALIDATION` — 公開中でない FAQ への投票
 */
export function vote(item: FaqItem, helpful: boolean, now = new Date()): FaqItem {
  if (item.status !== "published") {
    throw new AppError(ErrorCode.VALIDATION, "公開中の FAQ にのみ投票できます");
  }
  return {
    ...item,
    helpful: item.helpful + (helpful ? 1 : 0),
    notHelpful: item.notHelpful + (helpful ? 0 : 1),
    updatedAt: now.toISOString(),
  };
}

/** FAQ 全体の状況。 */
export interface FaqStats {
  total: number;
  published: number;
  draft: number;
  /** 全体の役に立った率(投票のあるものだけで計算)。 */
  helpfulRate: number | undefined;
  /** 要見直しの件数。 */
  needsReview: number;
  /** よく見られている順(上位 5 件)。 */
  topViewed: FaqItem[];
}

/**
 * FAQ 全体の状況をまとめる(管理画面用)。
 *
 * @param items 対象の FAQ
 * @returns 件数・役に立った率・要見直し数・閲覧上位
 */
export function summarizeFaq(items: FaqItem[]): FaqStats {
  const published = publishedOnly(items);
  let helpful = 0;
  let voted = 0;
  for (const i of published) {
    helpful += i.helpful;
    voted += i.helpful + i.notHelpful;
  }
  return {
    total: items.length,
    published: published.length,
    draft: items.filter((i) => i.status === "draft").length,
    helpfulRate: voted === 0 ? undefined : helpful / voted,
    needsReview: needsReview(items).length,
    topViewed: [...published].sort((a, b) => b.views - a.views).slice(0, 5),
  };
}
