/**
 * 基盤ポータル。**全 106 パッケージ**を検索して「作る前に探す」ための画面。
 *
 * Server Component で生成物を読む(1.2MB あるのでクライアントへ送らない)。
 * 検索・絞り込みだけを client 側に切り出している。
 */
import { PORTAL_REFERENCE, PORTAL_TOTALS } from "../../../lib/portal-reference.generated";
import { PortalIndex } from "./portal-index";

export const metadata = { title: "基盤ポータル(デモ)" };

export default function Page() {
  // 一覧に必要な分だけ渡す。entries(関数の詳細)は詳細ページで読むので送らない。
  const packages = PORTAL_REFERENCE.map((p) => ({
    name: p.name,
    category: p.category,
    summary: p.summary,
    functions: p.functions,
    types: p.types,
  }));
  return <PortalIndex packages={packages} totals={PORTAL_TOTALS} />;
}
