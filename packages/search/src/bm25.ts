/**
 * BM25 による転置インデックス検索(依存ゼロ)。
 * 語単位のスコアリング・複数語・フィールド重みに対応。メモリ検索の中核に使う。
 * @packageDocumentation
 */
import { tokenize } from "./tokenize.js";

/** フィールド重み(未指定は 1.0)。id は対象外。 */
export type FieldBoosts = Record<string, number>;

/** BM25 パラメータ。 */
export interface Bm25Options {
  /** 語の飽和度(既定 1.2)。 */
  k1?: number;
  /** 文書長の正規化(既定 0.75)。 */
  b?: number;
  /** フィールド別の重み。 */
  fieldBoosts?: FieldBoosts;
}

interface Posting { docId: string; tf: number }
interface IndexedDoc { id: string; length: number; raw: Record<string, unknown> }

/** 転置インデックス。 */
export interface Bm25Index {
  add(doc: { id: string } & Record<string, unknown>): void;
  addAll(docs: ({ id: string } & Record<string, unknown>)[]): void;
  remove(id: string): void;
  /** 検索して {id, score, doc} を降順で返す。 */
  search(query: string, limit: number): { id: string; score: number; doc: Record<string, unknown> }[];
  size(): number;
}

/** BM25 インデックスを作る。 */
export function createBm25Index(options: Bm25Options = {}): Bm25Index {
  const k1 = options.k1 ?? 1.2;
  const b = options.b ?? 0.75;
  const boosts = options.fieldBoosts ?? {};
  const postings = new Map<string, Posting[]>(); // term -> postings
  const docs = new Map<string, IndexedDoc>();
  let totalLength = 0;

  // 文書の各フィールドを重み付きでトークン化(重み分だけ語を複製=簡易ブースト)
  function docTokens(doc: Record<string, unknown>): string[] {
    const out: string[] = [];
    for (const [field, value] of Object.entries(doc)) {
      if (field === "id" || value == null) continue;
      const weight = Math.max(1, Math.round(boosts[field] ?? 1));
      const toks = tokenize(String(value));
      for (let w = 0; w < weight; w++) out.push(...toks);
    }
    return out;
  }

  function removeInternal(id: string) {
    const existing = docs.get(id);
    if (!existing) return;
    totalLength -= existing.length;
    docs.delete(id);
    for (const [term, list] of postings) {
      const filtered = list.filter((p) => p.docId !== id);
      if (filtered.length === 0) postings.delete(term);
      else postings.set(term, filtered);
    }
  }

  function add(doc: { id: string } & Record<string, unknown>) {
    removeInternal(doc.id); // 再インデックス
    const tokens = docTokens(doc);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const [term, count] of tf) {
      const list = postings.get(term) ?? [];
      list.push({ docId: doc.id, tf: count });
      postings.set(term, list);
    }
    docs.set(doc.id, { id: doc.id, length: tokens.length, raw: doc });
    totalLength += tokens.length;
  }

  return {
    add,
    addAll: (ds) => { for (const d of ds) add(d); },
    remove: removeInternal,
    size: () => docs.size,
    search(query, limit) {
      const N = docs.size;
      if (N === 0) return [];
      const avgdl = totalLength / N;
      const qterms = [...new Set(tokenize(query))];
      const scores = new Map<string, number>();
      for (const term of qterms) {
        const list = postings.get(term);
        if (!list) continue;
        const df = list.length;
        // BM25 の IDF(常に正になる平滑化版)
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        for (const { docId, tf } of list) {
          const dl = docs.get(docId)?.length ?? 0;
          const denom = tf + k1 * (1 - b + (b * dl) / (avgdl || 1));
          const score = idf * ((tf * (k1 + 1)) / (denom || 1));
          scores.set(docId, (scores.get(docId) ?? 0) + score);
        }
      }
      return [...scores.entries()]
        .map(([id, score]) => ({ id, score, doc: docs.get(id)!.raw }))
        .sort((a, b2) => b2.score - a.score)
        .slice(0, limit);
    },
  };
}
