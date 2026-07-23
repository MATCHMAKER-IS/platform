/**
 * 資料の検索索引(BM25)。節への分割は doc-sections.mts が担当する。
 * @packageDocumentation
 */
import { createBm25Index } from "@platform/search";
import { boostExactKeyword } from "@platform/rag";
import type { DocSection } from "./doc-sections.mjs";

export { loadDocSections, isGenerated, excerpt, type DocSection } from "./doc-sections.mjs";

/** 検索できる索引を作る。見出しを強めに効かせる。 */
export function buildDocIndex(sections: DocSection[]) {
  // パッケージ名は「どの部品を使うか」を探す最短の手がかりなので強く効かせる
  const index = createBm25Index({ fieldBoosts: { pkg: 8, heading: 3, breadcrumb: 2, file: 2, body: 1 } });
  index.addAll(sections.map((s) => ({ id: s.id, pkg: s.pkg ?? "", heading: s.heading, breadcrumb: s.breadcrumb, file: s.file, body: s.body })));
  return index;
}


/**
 * 検索して、パッケージ名の完全一致を優先した順で返す。
 * 「CSV を出力したい」で `packages/csv/README.md` が上位に来るようにする。
 */
export function searchDocs(
  index: ReturnType<typeof buildDocIndex>,
  sectionById: Map<string, DocSection>,
  query: string,
  limit: number,
): { id: string; score: number }[] {
  // 再ランクで順位が入れ替わるため、**十分に多め**に取ってから絞る。
  // 少ないと、部品名が一致する結果が候補に入る前に切られてしまう
  // (「CSV を出力したい」は一般的な語が強く、csv の README は上位 10 件に入らない)。
  const raw = index.search(query, Math.max(limit * 10, 60));
  const withPkg = raw.map((h) => ({ ...h, pkg: sectionById.get(h.id)?.pkg }));
  return boostExactKeyword(withPkg, query, (h) => h.pkg).slice(0, limit);
}
