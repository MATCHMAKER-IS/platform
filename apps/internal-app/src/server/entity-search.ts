/**
 * 横断全文検索。請求・取引先・監査ログ等の業務エンティティを 1 つの索引で全文検索する。基盤 @platform/search（BM25）を利用。
 * @packageDocumentation
 */
import { createSearch, createMemorySearch, type SearchDocument, type SearchHit } from "@platform/search";

/** 検索対象の共通ドキュメント。 */
export interface EntityDoc extends SearchDocument {
  id: string;
  type: "invoice" | "partner" | "audit";
  title: string;
  subtitle: string;
  href: string;
  text: string;
}

/** 請求をドキュメント化。 */
export function invoiceToDoc(inv: { number: string; billTo?: string; total?: number }): EntityDoc {
  return { id: `invoice:${inv.number}`, type: "invoice", title: inv.number, subtitle: inv.billTo ?? "", href: `/invoices`, text: `${inv.number} ${inv.billTo ?? ""} ${inv.total ?? ""}` };
}

/** 取引先をドキュメント化。 */
export function partnerToDoc(p: { code: string; name: string; kana?: string }): EntityDoc {
  return { id: `partner:${p.code}`, type: "partner", title: p.name, subtitle: p.code, href: `/partners`, text: `${p.name} ${p.kana ?? ""} ${p.code}` };
}

/** 監査行をドキュメント化。 */
export function auditToDoc(row: { seq: number; actor: string; action: string; target?: string }): EntityDoc {
  return { id: `audit:${row.seq}`, type: "audit", title: row.action, subtitle: `${row.actor}${row.target ? " → " + row.target : ""}`, href: `/audit`, text: `${row.action} ${row.actor} ${row.target ?? ""}` };
}

/** ドキュメント群を索引して検索する（都度索引・小規模向け）。 */
export async function searchEntities(docs: EntityDoc[], query: string, limit = 20): Promise<SearchHit<EntityDoc>[]> {
  const search = createSearch<EntityDoc>(createMemorySearch());
  const indexed = await search.index(docs);
  if (!indexed.ok) return [];
  const res = await search.search(query, limit);
  return res.ok ? res.value : [];
}

/** 検索結果を表示用の軽量な形に整える（type で絞り込み可）。 */
export function toSearchResults(hits: SearchHit<EntityDoc>[], type?: string): { type: string; title: string; subtitle: string; href: string; score?: number }[] {
  return hits
    .filter((h) => !type || h.document.type === type)
    .map((h) => ({ type: h.document.type, title: h.document.title, subtitle: h.document.subtitle, href: h.document.href, ...(h.score !== undefined ? { score: h.score } : {}) }));
}
